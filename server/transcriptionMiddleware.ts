import { createWriteStream, mkdtempSync, rmSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type {
  TranscriptionLanguageCode,
  WhisperModelSize,
} from '../src/types/transcription.ts'
import {
  AudioExtractionError,
  validateSupportedExtension,
} from './transcription/audioExtractor.ts'
import { inspectTranscriptionEnvironment } from './transcription/environment.ts'
import {
  DuplicateTranscriptionJobError,
  TranscriptionJobManager,
} from './transcription/jobManager.ts'

const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024 // 1 GiB local loopback ceiling
const VALID_MODELS = new Set<WhisperModelSize>(['tiny', 'base', 'small', 'medium'])

let sharedManager: TranscriptionJobManager | null = null

export function getSharedTranscriptionManager(): TranscriptionJobManager {
  if (!sharedManager) {
    sharedManager = new TranscriptionJobManager()
  }
  return sharedManager
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function isAllowedOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]'
    )
  } catch {
    return false
  }
}

function streamBodyToFile(
  req: IncomingMessage,
  targetPath: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const writer = createWriteStream(targetPath)
    let totalBytes = 0
    let finished = false

    const fail = (err: Error) => {
      if (finished) return
      finished = true
      writer.destroy()
      reject(err)
    }

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length
      if (totalBytes > MAX_UPLOAD_BYTES) {
        req.destroy()
        fail(
          new Error('Video payload exceeds the 1 GiB local transcription upload limit.'),
        )
        return
      }
      writer.write(chunk)
    })

    req.on('end', () => {
      writer.end()
    })

    writer.on('finish', () => {
      if (finished) return
      finished = true
      resolve(totalBytes)
    })

    writer.on('error', fail)
    req.on('error', fail)
  })
}

/**
 * Handles /api/transcription/* local audio extraction and Whisper transcription endpoints.
 */
export async function handleTranscriptionApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  manager: TranscriptionJobManager = getSharedTranscriptionManager(),
): Promise<boolean> {
  const rawUrl = req.url || '/'
  const pathname = rawUrl.split('?')[0]

  if (!pathname.startsWith('/api/transcription')) {
    return false
  }

  if (!isAllowedOrigin(req)) {
    sendJson(res, 403, { error: 'Unauthorized origin for local transcription.' })
    return true
  }

  try {
    // GET /api/transcription/environment
    if (pathname === '/api/transcription/environment' && req.method === 'GET') {
      const envStatus = await inspectTranscriptionEnvironment()
      sendJson(res, 200, envStatus)
      return true
    }

    // GET /api/transcription/jobs
    if (pathname === '/api/transcription/jobs' && req.method === 'GET') {
      sendJson(res, 200, { jobs: manager.listJobs() })
      return true
    }

    // POST /api/transcription/jobs
    if (pathname === '/api/transcription/jobs' && req.method === 'POST') {
      const videoIdHeader = req.headers['x-video-id']
      const fileNameHeader = req.headers['x-file-name']
      const modelHeader = req.headers['x-model']
      const langHeader = req.headers['x-language']

      const videoId =
        typeof videoIdHeader === 'string' ? decodeURIComponent(videoIdHeader).trim() : ''
      const fileName =
        typeof fileNameHeader === 'string'
          ? basename(decodeURIComponent(fileNameHeader).trim())
          : ''
      const modelSize =
        typeof modelHeader === 'string' && VALID_MODELS.has(modelHeader as WhisperModelSize)
          ? (modelHeader as WhisperModelSize)
          : 'base'
      const language =
        typeof langHeader === 'string' && langHeader.trim()
          ? (langHeader.trim() as TranscriptionLanguageCode)
          : 'auto'

      if (!videoId || !fileName) {
        sendJson(res, 400, {
          error: 'Missing required headers (x-video-id and x-file-name).',
        })
        return true
      }

      const extension = validateSupportedExtension(fileName)
      const tempDir = mkdtempSync(join(tmpdir(), 'astrocut-tx-'))
      const tempVideoPath = join(tempDir, `source.${extension}`)

      try {
        const bytes = await streamBodyToFile(req, tempVideoPath)
        if (bytes <= 0) {
          rmSync(tempDir, { recursive: true, force: true })
          sendJson(res, 400, {
            error: 'Uploaded video payload was empty (0 bytes).',
          })
          return true
        }

        const job = manager.enqueue({
          videoId,
          fileName,
          fileExtension: extension,
          modelSize,
          language,
          tempDir,
          tempVideoPath,
        })
        sendJson(res, 202, { job })
        return true
      } catch (err) {
        rmSync(tempDir, { recursive: true, force: true })
        throw err
      }
    }

    // GET /api/transcription/jobs/:jobId
    const jobMatch = pathname.match(/^\/api\/transcription\/jobs\/([^/]+)$/)
    if (jobMatch && req.method === 'GET') {
      const jobId = decodeURIComponent(jobMatch[1])
      const job = manager.getJob(jobId)
      if (!job) {
        sendJson(res, 404, { error: 'Transcription job not found.' })
        return true
      }
      sendJson(res, 200, { job })
      return true
    }

    // DELETE /api/transcription/jobs/video/:videoId
    const deleteMatch = pathname.match(
      /^\/api\/transcription\/jobs\/video\/([^/]+)$/,
    )
    if (deleteMatch && req.method === 'DELETE') {
      const videoId = decodeURIComponent(deleteMatch[1])
      const removed = manager.deleteVideoJobs(videoId)
      sendJson(res, 200, { removed })
      return true
    }

    sendJson(res, 404, { error: `Unknown transcription endpoint: ${pathname}` })
    return true
  } catch (err) {
    if (err instanceof DuplicateTranscriptionJobError) {
      sendJson(res, 409, {
        error: err.message,
        activeJobId: err.activeJobId,
      })
      return true
    }
    if (err instanceof AudioExtractionError) {
      sendJson(res, 400, { error: err.message, code: err.code })
      return true
    }
    sendJson(res, 500, {
      error:
        err instanceof Error ? err.message : 'Transcription server error.',
    })
    return true
  }
}
