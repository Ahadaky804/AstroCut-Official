import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  TranscriptionJobResult,
  TranscriptionLanguageCode,
  WhisperModelSize,
} from '../../src/types/transcription.ts'
import {
  resolvePythonInvocation,
  resolveWhisperCacheDir,
} from './environment.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNNER_PATH = join(HERE, 'whisper_runner.py')

export interface WhisperRunCallbacks {
  onStage?: (stage: 'loading_model' | 'transcribing', detail: string) => void
  signal?: AbortSignal
}

export type WhisperEngineRunner = (input: {
  wavPath: string
  modelSize: WhisperModelSize
  language: TranscriptionLanguageCode
  cacheDir: string
  callbacks?: WhisperRunCallbacks
}) => Promise<TranscriptionJobResult>

export class WhisperExecutionError extends Error {
  readonly code: 'whisper_missing' | 'execution_failed' | 'invalid_output' | 'aborted'

  constructor(
    message: string,
    code: 'whisper_missing' | 'execution_failed' | 'invalid_output' | 'aborted',
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'WhisperExecutionError'
    this.code = code
  }
}

function normalizeWhisperOutput(
  parsed: unknown,
  requestedModel: WhisperModelSize,
): TranscriptionJobResult {
  if (!parsed || typeof parsed !== 'object') {
    throw new WhisperExecutionError(
      'Local Whisper returned an unexpected empty output.',
      'invalid_output',
    )
  }

  const obj = parsed as Record<string, unknown>
  const rawSegments = Array.isArray(obj.segments) ? obj.segments : []
  const segments = rawSegments
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .map((seg, idx) => {
      const startSeconds = Number(seg.startSeconds ?? seg.start ?? 0)
      const endSeconds = Number(seg.endSeconds ?? seg.end ?? startSeconds + 1)
      const text = String(seg.text ?? '').trim()
      return {
        id: String(seg.id ?? `seg-${idx + 1}`),
        startSeconds: Number.isFinite(startSeconds) ? Math.max(0, startSeconds) : 0,
        endSeconds: Number.isFinite(endSeconds)
          ? Math.max(startSeconds, endSeconds)
          : Math.max(0, startSeconds + 1),
        text,
      }
    })
    .filter((seg) => seg.text.length > 0)

  const languageCode = String(obj.languageCode ?? obj.language ?? 'unknown').trim()
  const detectedLanguage = String(obj.detectedLanguage ?? languageCode).trim()
  const originalText =
    typeof obj.originalText === 'string' && obj.originalText.trim()
      ? obj.originalText.trim()
      : segments.map((s) => s.text).join('\n')

  return {
    languageCode: languageCode || 'unknown',
    detectedLanguage: detectedLanguage || 'unknown',
    modelSize: requestedModel,
    engineName: String(obj.engineName || 'local-whisper'),
    deviceUsed: String(obj.deviceUsed || 'cpu'),
    fallbackNote:
      typeof obj.fallbackNote === 'string' && obj.fallbackNote.trim()
        ? obj.fallbackNote.trim()
        : undefined,
    segments,
    originalText,
  }
}

export const defaultWhisperEngineRunner: WhisperEngineRunner = async ({
  wavPath,
  modelSize,
  language,
  cacheDir,
  callbacks,
}) => {
  const customCmd = process.env.ASTROCUT_WHISPER_CMD?.trim()
  let spawnCmd: string
  let spawnArgs: string[]

  if (customCmd) {
    spawnCmd = customCmd
    spawnArgs = [
      '--audio',
      wavPath,
      '--model',
      modelSize,
      '--language',
      language,
      '--cache-dir',
      cacheDir,
    ]
  } else {
    const py = await resolvePythonInvocation()
    if (!py) {
      throw new WhisperExecutionError(
        'Python 3 was not found. Install Python 3.10–3.13 and faster-whisper (see TRANSCRIPTION_SETUP.md).',
        'whisper_missing',
      )
    }
    if (!existsSync(RUNNER_PATH)) {
      throw new WhisperExecutionError(
        'AstroCut Whisper runner script is missing from server/transcription/whisper_runner.py.',
        'execution_failed',
      )
    }
    spawnCmd = py.command
    spawnArgs = [
      ...py.prefixArgs,
      RUNNER_PATH,
      '--audio',
      wavPath,
      '--model',
      modelSize,
      '--language',
      language,
      '--cache-dir',
      cacheDir,
      '--device',
      'auto',
    ]
  }

  return new Promise<TranscriptionJobResult>((resolvePromise, rejectPromise) => {
    const child = spawn(spawnCmd, spawnArgs, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdoutBuf = ''
    let stderrTail = ''
    let stderrLineBuf = ''
    let settled = false

    const abortHandler = () => {
      if (settled) return
      settled = true
      child.kill()
      rejectPromise(
        new WhisperExecutionError('Transcription job was cancelled.', 'aborted'),
      )
    }

    if (callbacks?.signal) {
      if (callbacks.signal.aborted) {
        abortHandler()
        return
      }
      callbacks.signal.addEventListener('abort', abortHandler, { once: true })
    }

    const cleanupSignal = () => {
      callbacks?.signal?.removeEventListener('abort', abortHandler)
    }

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf8')
    })

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      stderrLineBuf += text
      stderrTail = `${stderrTail}${text}`.slice(-2500)

      const lines = stderrLineBuf.split(/\r?\n/)
      stderrLineBuf = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('{')) continue
        try {
          const evt = JSON.parse(trimmed) as { stage?: string; detail?: string }
          if (evt.stage === 'loading_model' || evt.stage === 'transcribing') {
            callbacks?.onStage?.(evt.stage, evt.detail || '')
          }
        } catch {
          // Ignore non-JSON stderr log lines
        }
      }
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      cleanupSignal()
      rejectPromise(
        new WhisperExecutionError(
          `Failed to start local Whisper process: ${err.message}`,
          'whisper_missing',
          { cause: err },
        ),
      )
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      cleanupSignal()

      if (code !== 0) {
        const reason = stderrTail.trim() || `Process exited with code ${code}`
        rejectPromise(
          new WhisperExecutionError(reason, 'execution_failed'),
        )
        return
      }

      try {
        const parsed = JSON.parse(stdoutBuf.trim())
        resolvePromise(normalizeWhisperOutput(parsed, modelSize))
      } catch (err) {
        rejectPromise(
          new WhisperExecutionError(
            'Local Whisper produced malformed JSON output.',
            'invalid_output',
            { cause: err },
          ),
        )
      }
    })
  })
}

export async function runLocalWhisperTranscription(
  wavPath: string,
  modelSize: WhisperModelSize,
  language: TranscriptionLanguageCode,
  options?: {
    cacheDir?: string
    runner?: WhisperEngineRunner
    callbacks?: WhisperRunCallbacks
  },
): Promise<TranscriptionJobResult> {
  const runner = options?.runner ?? defaultWhisperEngineRunner
  const cacheDir = options?.cacheDir ?? resolveWhisperCacheDir()
  return runner({
    wavPath,
    modelSize,
    language,
    cacheDir,
    callbacks: options?.callbacks,
  })
}
