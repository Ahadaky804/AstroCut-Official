import { execFile } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { promisify } from 'node:util'
import type { SupportedVideoExtension } from '../../src/types/video.ts'
import { resolveFfmpegCommand } from './environment.ts'

const execFileAsync = promisify(execFile)

const SUPPORTED_EXTENSIONS = new Set<SupportedVideoExtension>(['mp4', 'mov', 'webm'])

export type FfmpegRunner = (
  ffmpegPath: string,
  args: string[],
  timeoutMs: number,
) => Promise<{ stdout: string; stderr: string }>

const defaultFfmpegRunner: FfmpegRunner = async (ffmpegPath, args, timeoutMs) => {
  const { stdout, stderr } = await execFileAsync(ffmpegPath, args, {
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  })
  return {
    stdout: String(stdout ?? ''),
    stderr: String(stderr ?? ''),
  }
}

export class AudioExtractionError extends Error {
  readonly code:
    | 'unsupported_format'
    | 'ffmpeg_missing'
    | 'no_audio_stream'
    | 'extraction_failed'

  constructor(
    message: string,
    code:
      | 'unsupported_format'
      | 'ffmpeg_missing'
      | 'no_audio_stream'
      | 'extraction_failed',
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'AudioExtractionError'
    this.code = code
  }
}

export function validateSupportedExtension(
  fileName: string,
): SupportedVideoExtension {
  const ext = extname(fileName).replace(/^\./, '').toLowerCase()
  if (!SUPPORTED_EXTENSIONS.has(ext as SupportedVideoExtension)) {
    throw new AudioExtractionError(
      `Unsupported video format "${ext || 'unknown'}". Supported formats for local audio extraction are MP4, MOV, and WebM.`,
      'unsupported_format',
    )
  }
  return ext as SupportedVideoExtension
}

/**
 * Extracts a mono 16kHz PCM WAV track locally using FFmpeg into a temporary file.
 */
export async function extractAudioToWav(
  inputVideoPath: string,
  outputDir: string,
  originalFileName: string,
  options?: {
    ffmpegPath?: string
    timeoutMs?: number
    runner?: FfmpegRunner
  },
): Promise<{ wavPath: string; extension: SupportedVideoExtension }> {
  const extension = validateSupportedExtension(originalFileName)

  if (!existsSync(inputVideoPath)) {
    throw new AudioExtractionError(
      'Temporary uploaded video file was not found before audio extraction.',
      'extraction_failed',
    )
  }

  const stat = statSync(inputVideoPath)
  if (stat.size <= 0) {
    throw new AudioExtractionError(
      'Uploaded video file is empty (0 bytes) and cannot be processed.',
      'extraction_failed',
    )
  }

  const ffmpegPath = options?.ffmpegPath || resolveFfmpegCommand()
  const wavPath = join(outputDir, 'extracted-audio.wav')
  const timeoutMs = options?.timeoutMs ?? 5 * 60 * 1000
  const runner = options?.runner ?? defaultFfmpegRunner

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputVideoPath,
    '-vn',
    '-acodec',
    'pcm_s16le',
    '-ar',
    '16000',
    '-ac',
    '1',
    wavPath,
  ]

  try {
    await runner(ffmpegPath, args, timeoutMs)
  } catch (err) {
    const errObj = err as {
      code?: string | number
      stderr?: string | Buffer
      message?: string
    }
    const stderrText = String(errObj.stderr ?? errObj.message ?? '').trim()

    if (errObj.code === 'ENOENT' || /not recognized|enoent/i.test(stderrText)) {
      throw new AudioExtractionError(
        'FFmpeg was not found on this machine. Install FFmpeg and add it to PATH (or set ASTROCUT_FFMPEG_PATH).',
        'ffmpeg_missing',
        { cause: err },
      )
    }

    if (
      /does not contain any stream|matches no streams|stream specifier .* matches/i.test(
        stderrText,
      )
    ) {
      throw new AudioExtractionError(
        `This ${extension.toUpperCase()} video has no audio track to transcribe.`,
        'no_audio_stream',
        { cause: err },
      )
    }

    throw new AudioExtractionError(
      stderrText
        ? `FFmpeg audio extraction failed for ${extension.toUpperCase()}: ${stderrText.slice(0, 300)}`
        : `FFmpeg audio extraction failed for this ${extension.toUpperCase()} file.`,
      'extraction_failed',
      { cause: err },
    )
  }

  if (!existsSync(wavPath) || statSync(wavPath).size <= 44) {
    throw new AudioExtractionError(
      'FFmpeg completed without producing a playable audio track. Verify the video contains audio.',
      'no_audio_stream',
    )
  }

  return { wavPath, extension }
}
