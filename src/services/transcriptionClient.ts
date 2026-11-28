import type {
  TranscriptionEnvironmentStatus,
  TranscriptionJobSnapshot,
  TranscriptionLanguageCode,
  WhisperModelSize,
} from '../types/transcription'

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    const msg =
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `Transcription request failed with HTTP ${response.status}.`
    throw new Error(msg)
  }

  if (parsed === null) {
    throw new Error('Transcription server returned an empty or invalid JSON response.')
  }

  return parsed as T
}

export const transcriptionClient = {
  async getEnvironment(): Promise<TranscriptionEnvironmentStatus> {
    const res = await fetch('/api/transcription/environment', {
      method: 'GET',
    })
    return parseJsonResponse<TranscriptionEnvironmentStatus>(res)
  },

  async listJobs(): Promise<TranscriptionJobSnapshot[]> {
    const res = await fetch('/api/transcription/jobs', { method: 'GET' })
    const data = await parseJsonResponse<{ jobs: TranscriptionJobSnapshot[] }>(
      res,
    )
    return data.jobs
  },

  async getJob(jobId: string): Promise<TranscriptionJobSnapshot> {
    const res = await fetch(
      `/api/transcription/jobs/${encodeURIComponent(jobId)}`,
      { method: 'GET' },
    )
    const data = await parseJsonResponse<{ job: TranscriptionJobSnapshot }>(res)
    return data.job
  },

  async startTranscription(input: {
    videoId: string
    fileName: string
    blob: Blob
    modelSize: WhisperModelSize
    language: TranscriptionLanguageCode
  }): Promise<TranscriptionJobSnapshot> {
    const res = await fetch('/api/transcription/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-video-id': encodeURIComponent(input.videoId),
        'x-file-name': encodeURIComponent(input.fileName),
        'x-model': input.modelSize,
        'x-language': input.language,
      },
      body: input.blob,
    })
    const data = await parseJsonResponse<{ job: TranscriptionJobSnapshot }>(res)
    return data.job
  },

  async deleteVideoJobs(videoId: string): Promise<void> {
    await fetch(
      `/api/transcription/jobs/video/${encodeURIComponent(videoId)}`,
      { method: 'DELETE' },
    )
  },
}
