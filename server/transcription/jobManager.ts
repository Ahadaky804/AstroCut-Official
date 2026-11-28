import { existsSync, rmSync } from 'node:fs'
import type {
  TranscriptionJobResult,
  TranscriptionJobSnapshot,
  TranscriptionLanguageCode,
  TranscriptionStage,
  WhisperModelSize,
} from '../../src/types/transcription.ts'
import type { SupportedVideoExtension } from '../../src/types/video.ts'
import {
  extractAudioToWav,
  type FfmpegRunner,
} from './audioExtractor.ts'
import { resolveWhisperCacheDir } from './environment.ts'
import {
  runLocalWhisperTranscription,
  type WhisperEngineRunner,
} from './whisperEngine.ts'

export class DuplicateTranscriptionJobError extends Error {
  readonly activeJobId: string

  constructor(videoId: string, activeJobId: string) {
    super(
      `Video "${videoId}" already has an active transcription job (${activeJobId}).`,
    )
    this.name = 'DuplicateTranscriptionJobError'
    this.activeJobId = activeJobId
  }
}

export interface EnqueueTranscriptionInput {
  videoId: string
  fileName: string
  fileExtension: SupportedVideoExtension
  modelSize: WhisperModelSize
  language: TranscriptionLanguageCode
  tempDir: string
  tempVideoPath: string
}

interface InternalJob {
  snapshot: TranscriptionJobSnapshot
  tempDir: string
  tempVideoPath: string
  abortController: AbortController
  cancelled: boolean
}

export interface TranscriptionPipelineDeps {
  extractAudio?: (
    inputVideoPath: string,
    outputDir: string,
    originalFileName: string,
  ) => Promise<{ wavPath: string }>
  transcribeAudio?: (
    wavPath: string,
    modelSize: WhisperModelSize,
    language: TranscriptionLanguageCode,
    callbacks: {
      onStage: (stage: 'loading_model' | 'transcribing', detail: string) => void
      signal: AbortSignal
    },
  ) => Promise<TranscriptionJobResult>
  ffmpegRunner?: FfmpegRunner
  whisperRunner?: WhisperEngineRunner
}

export class TranscriptionJobManager {
  private readonly jobs = new Map<string, InternalJob>()
  private readonly queue: string[] = []
  private activeJobId: string | null = null
  private readonly deps: TranscriptionPipelineDeps

  constructor(deps: TranscriptionPipelineDeps = {}) {
    this.deps = deps
  }

  private safeCleanupDir(dir: string): void {
    if (!dir || !existsSync(dir)) return
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // Ignore Windows handle lag cleanly
    }
  }

  private updateStage(
    job: InternalJob,
    stage: TranscriptionStage,
    stageMessage: string,
    status?: TranscriptionJobSnapshot['status'],
  ): void {
    job.snapshot.stage = stage
    job.snapshot.stageMessage = stageMessage
    if (status) job.snapshot.status = status
    job.snapshot.updatedAt = new Date().toISOString()
  }

  enqueue(input: EnqueueTranscriptionInput): TranscriptionJobSnapshot {
    for (const existing of this.jobs.values()) {
      if (
        existing.snapshot.videoId === input.videoId &&
        (existing.snapshot.status === 'waiting' ||
          existing.snapshot.status === 'processing')
      ) {
        this.safeCleanupDir(input.tempDir)
        throw new DuplicateTranscriptionJobError(
          input.videoId,
          existing.snapshot.jobId,
        )
      }
    }

    const now = new Date().toISOString()
    const jobId = `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const internal: InternalJob = {
      tempDir: input.tempDir,
      tempVideoPath: input.tempVideoPath,
      abortController: new AbortController(),
      cancelled: false,
      snapshot: {
        jobId,
        videoId: input.videoId,
        fileName: input.fileName,
        fileExtension: input.fileExtension,
        modelSize: input.modelSize,
        requestedLanguage: input.language,
        status: 'waiting',
        stage: 'waiting',
        stageMessage: 'Queued locally for audio extraction...',
        createdAt: now,
        updatedAt: now,
      },
    }

    this.jobs.set(jobId, internal)
    this.queue.push(jobId)
    void this.drainQueue()

    return { ...internal.snapshot }
  }

  getJob(jobId: string): TranscriptionJobSnapshot | null {
    const job = this.jobs.get(jobId)
    return job ? { ...job.snapshot } : null
  }

  listJobs(): TranscriptionJobSnapshot[] {
    return Array.from(this.jobs.values())
      .map((j) => ({ ...j.snapshot }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  deleteVideoJobs(videoId: string): number {
    let removed = 0
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.snapshot.videoId !== videoId) continue
      job.cancelled = true
      job.abortController.abort()
      const idx = this.queue.indexOf(jobId)
      if (idx !== -1) this.queue.splice(idx, 1)
      this.safeCleanupDir(job.tempDir)
      this.jobs.delete(jobId)
      removed += 1
    }
    return removed
  }

  private async drainQueue(): Promise<void> {
    if (this.activeJobId !== null) return

    while (this.queue.length > 0) {
      const nextId = this.queue.shift()!
      const job = this.jobs.get(nextId)
      if (!job || job.cancelled) continue

      this.activeJobId = nextId
      await this.processJob(job)
      this.activeJobId = null
    }
  }

  private async processJob(job: InternalJob): Promise<void> {
    try {
      this.updateStage(
        job,
        'preparing_audio',
        `Extracting mono 16kHz WAV audio from ${job.snapshot.fileExtension.toUpperCase()}...`,
        'processing',
      )

      const extracted = this.deps.extractAudio
        ? await this.deps.extractAudio(
            job.tempVideoPath,
            job.tempDir,
            job.snapshot.fileName,
          )
        : await extractAudioToWav(
            job.tempVideoPath,
            job.tempDir,
            job.snapshot.fileName,
            { runner: this.deps.ffmpegRunner },
          )

      if (job.cancelled || job.abortController.signal.aborted) {
        return
      }

      this.updateStage(
        job,
        'loading_model',
        `Loading local Whisper "${job.snapshot.modelSize}" model...`,
      )

      const result = this.deps.transcribeAudio
        ? await this.deps.transcribeAudio(
            extracted.wavPath,
            job.snapshot.modelSize,
            job.snapshot.requestedLanguage,
            {
              onStage: (stage, detail) => {
                if (job.cancelled) return
                this.updateStage(
                  job,
                  stage,
                  detail ||
                    (stage === 'loading_model'
                      ? `Loading local Whisper "${job.snapshot.modelSize}" model...`
                      : 'Transcribing spoken audio...'),
                )
              },
              signal: job.abortController.signal,
            },
          )
        : await runLocalWhisperTranscription(
            extracted.wavPath,
            job.snapshot.modelSize,
            job.snapshot.requestedLanguage,
            {
              cacheDir: resolveWhisperCacheDir(),
              runner: this.deps.whisperRunner,
              callbacks: {
                signal: job.abortController.signal,
                onStage: (stage, detail) => {
                  if (job.cancelled) return
                  this.updateStage(
                    job,
                    stage,
                    detail ||
                      (stage === 'loading_model'
                        ? `Loading local Whisper "${job.snapshot.modelSize}" model...`
                        : 'Transcribing spoken audio...'),
                  )
                },
              },
            },
          )

      if (job.cancelled) return

      this.updateStage(
        job,
        'saving_transcript',
        'Preparing transcript segments for browser IndexedDB storage...',
      )

      job.snapshot.result = result
      this.updateStage(
        job,
        'completed',
        `Completed with ${result.engineName} (${result.deviceUsed}).`,
        'completed',
      )
    } catch (err) {
      if (job.cancelled) return
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Local transcription failed.'
      job.snapshot.error = msg
      this.updateStage(job, 'failed', msg, 'failed')
    } finally {
      this.safeCleanupDir(job.tempDir)
    }
  }
}
