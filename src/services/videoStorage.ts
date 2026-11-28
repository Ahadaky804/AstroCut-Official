import type {
  TranscriptionStage,
  TranscriptionStatus,
  VideoTranscriptRecord,
} from '../types/transcription'
import type { VideoRecord } from '../types/video'
import {
  awaitIdbRequest,
  awaitIdbTransaction,
  BLOB_STORE,
  openAstroCutDatabase,
  TRANSCRIPT_STORE,
  VIDEO_STORE,
} from './indexedDb'

interface StoredBlobEntry {
  id: string
  blob: Blob
}

/**
 * Storage abstraction prepared for future backend repository implementations.
 */
export interface VideoStorageRepository {
  list(): Promise<VideoRecord[]>
  getBlob(id: string): Promise<Blob | null>
  save(record: VideoRecord, blob: Blob): Promise<void>
  rename(id: string, title: string): Promise<VideoRecord>
  updateTranscriptionState(
    id: string,
    patch: {
      transcriptionStatus: TranscriptionStatus
      transcriptionStage?: TranscriptionStage
      transcriptionError?: string
      lastTranscribedAt?: string
    },
  ): Promise<VideoRecord>
  listTranscripts(): Promise<VideoTranscriptRecord[]>
  getTranscript(videoId: string): Promise<VideoTranscriptRecord | null>
  saveTranscript(record: VideoTranscriptRecord): Promise<void>
  remove(id: string): Promise<void>
}

/**
 * IndexedDB implementation storing video metadata, binary blobs, and transcripts locally.
 */
export const indexedDbVideoStorage: VideoStorageRepository = {
  async list(): Promise<VideoRecord[]> {
    const db = await openAstroCutDatabase()
    try {
      const tx = db.transaction(VIDEO_STORE, 'readonly')
      const store = tx.objectStore(VIDEO_STORE)
      const records = await awaitIdbRequest<VideoRecord[]>(store.getAll())
      await awaitIdbTransaction(tx)
      return records.sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      )
    } finally {
      db.close()
    }
  },

  async getBlob(id: string): Promise<Blob | null> {
    const db = await openAstroCutDatabase()
    try {
      const tx = db.transaction(BLOB_STORE, 'readonly')
      const store = tx.objectStore(BLOB_STORE)
      const entry = await awaitIdbRequest<StoredBlobEntry | undefined>(
        store.get(id),
      )
      await awaitIdbTransaction(tx)
      return entry?.blob ?? null
    } finally {
      db.close()
    }
  },

  async save(record: VideoRecord, blob: Blob): Promise<void> {
    const db = await openAstroCutDatabase()
    try {
      const tx = db.transaction([VIDEO_STORE, BLOB_STORE], 'readwrite')
      tx.objectStore(VIDEO_STORE).put(record)
      tx.objectStore(BLOB_STORE).put({
        id: record.id,
        blob,
      } satisfies StoredBlobEntry)
      await awaitIdbTransaction(tx)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        throw new Error(
          'Browser storage quota exceeded. Delete unused videos to free space.',
          { cause: err },
        )
      }
      throw err
    } finally {
      db.close()
    }
  },

  async rename(id: string, title: string): Promise<VideoRecord> {
    const db = await openAstroCutDatabase()
    try {
      const tx = db.transaction(VIDEO_STORE, 'readwrite')
      const store = tx.objectStore(VIDEO_STORE)
      const existing = await awaitIdbRequest<VideoRecord | undefined>(
        store.get(id),
      )
      if (!existing) {
        throw new Error('Video record no longer exists in local storage.')
      }
      const updated: VideoRecord = {
        ...existing,
        title,
        updatedAt: new Date().toISOString(),
      }
      store.put(updated)
      await awaitIdbTransaction(tx)
      return updated
    } finally {
      db.close()
    }
  },

  async updateTranscriptionState(
    id: string,
    patch: {
      transcriptionStatus: TranscriptionStatus
      transcriptionStage?: TranscriptionStage
      transcriptionError?: string
      lastTranscribedAt?: string
    },
  ): Promise<VideoRecord> {
    const db = await openAstroCutDatabase()
    try {
      const tx = db.transaction(VIDEO_STORE, 'readwrite')
      const store = tx.objectStore(VIDEO_STORE)
      const existing = await awaitIdbRequest<VideoRecord | undefined>(
        store.get(id),
      )
      if (!existing) {
        throw new Error('Video record no longer exists in local storage.')
      }
      const updated: VideoRecord = {
        ...existing,
        transcriptionStatus: patch.transcriptionStatus,
        transcriptionStage: patch.transcriptionStage,
        transcriptionError: patch.transcriptionError,
        lastTranscribedAt: patch.lastTranscribedAt ?? existing.lastTranscribedAt,
        updatedAt: new Date().toISOString(),
      }
      store.put(updated)
      await awaitIdbTransaction(tx)
      return updated
    } finally {
      db.close()
    }
  },

  async listTranscripts(): Promise<VideoTranscriptRecord[]> {
    const db = await openAstroCutDatabase()
    try {
      const tx = db.transaction(TRANSCRIPT_STORE, 'readonly')
      const store = tx.objectStore(TRANSCRIPT_STORE)
      const records = await awaitIdbRequest<VideoTranscriptRecord[]>(
        store.getAll(),
      )
      await awaitIdbTransaction(tx)
      return records
    } finally {
      db.close()
    }
  },

  async getTranscript(
    videoId: string,
  ): Promise<VideoTranscriptRecord | null> {
    const db = await openAstroCutDatabase()
    try {
      const tx = db.transaction(TRANSCRIPT_STORE, 'readonly')
      const store = tx.objectStore(TRANSCRIPT_STORE)
      const record = await awaitIdbRequest<VideoTranscriptRecord | undefined>(
        store.get(videoId),
      )
      await awaitIdbTransaction(tx)
      return record ?? null
    } finally {
      db.close()
    }
  },

  async saveTranscript(record: VideoTranscriptRecord): Promise<void> {
    const db = await openAstroCutDatabase()
    try {
      const tx = db.transaction(TRANSCRIPT_STORE, 'readwrite')
      tx.objectStore(TRANSCRIPT_STORE).put(record)
      await awaitIdbTransaction(tx)
    } finally {
      db.close()
    }
  },

  async remove(id: string): Promise<void> {
    const db = await openAstroCutDatabase()
    try {
      const tx = db.transaction(
        [VIDEO_STORE, BLOB_STORE, TRANSCRIPT_STORE],
        'readwrite',
      )
      tx.objectStore(VIDEO_STORE).delete(id)
      tx.objectStore(BLOB_STORE).delete(id)
      tx.objectStore(TRANSCRIPT_STORE).delete(id)
      await awaitIdbTransaction(tx)
    } finally {
      db.close()
    }
  },
}
