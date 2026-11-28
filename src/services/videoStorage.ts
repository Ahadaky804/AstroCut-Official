import type {
  TranscriptionStage,
  TranscriptionStatus,
  VideoTranscriptRecord,
} from '../types/transcription'
import type { VideoRecord } from '../types/video'

const DB_NAME = 'astrocut-media-db'
const DB_VERSION = 2
const VIDEO_STORE = 'videos'
const BLOB_STORE = 'videoBlobs'
const TRANSCRIPT_STORE = 'transcripts'

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

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('IndexedDB is not supported in this browser.'),
    )
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        const store = db.createObjectStore(VIDEO_STORE, { keyPath: 'id' })
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(TRANSCRIPT_STORE)) {
        db.createObjectStore(TRANSCRIPT_STORE, { keyPath: 'videoId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        request.error ?? new Error('Unable to open local AstroCut database.'),
      )
  })
}

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () =>
      reject(tx.error ?? new Error('Storage transaction was aborted.'))
    tx.onerror = () =>
      reject(tx.error ?? new Error('Storage transaction failed.'))
  })
}

/**
 * IndexedDB implementation storing video metadata and binary blobs locally.
 */
export const indexedDbVideoStorage: VideoStorageRepository = {
  async list(): Promise<VideoRecord[]> {
    const db = await openDatabase()
    try {
      const tx = db.transaction(VIDEO_STORE, 'readonly')
      const store = tx.objectStore(VIDEO_STORE)
      const records = await awaitRequest<VideoRecord[]>(store.getAll())
      await awaitTransaction(tx)
      return records.sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      )
    } finally {
      db.close()
    }
  },

  async getBlob(id: string): Promise<Blob | null> {
    const db = await openDatabase()
    try {
      const tx = db.transaction(BLOB_STORE, 'readonly')
      const store = tx.objectStore(BLOB_STORE)
      const entry = await awaitRequest<StoredBlobEntry | undefined>(store.get(id))
      await awaitTransaction(tx)
      return entry?.blob ?? null
    } finally {
      db.close()
    }
  },

  async save(record: VideoRecord, blob: Blob): Promise<void> {
    const db = await openDatabase()
    try {
      const tx = db.transaction([VIDEO_STORE, BLOB_STORE], 'readwrite')
      tx.objectStore(VIDEO_STORE).put(record)
      tx.objectStore(BLOB_STORE).put({ id: record.id, blob } satisfies StoredBlobEntry)
      await awaitTransaction(tx)
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
    const db = await openDatabase()
    try {
      const tx = db.transaction(VIDEO_STORE, 'readwrite')
      const store = tx.objectStore(VIDEO_STORE)
      const existing = await awaitRequest<VideoRecord | undefined>(store.get(id))
      if (!existing) {
        throw new Error('Video record no longer exists in local storage.')
      }
      const updated: VideoRecord = {
        ...existing,
        title,
        updatedAt: new Date().toISOString(),
      }
      store.put(updated)
      await awaitTransaction(tx)
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
    const db = await openDatabase()
    try {
      const tx = db.transaction(VIDEO_STORE, 'readwrite')
      const store = tx.objectStore(VIDEO_STORE)
      const existing = await awaitRequest<VideoRecord | undefined>(store.get(id))
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
      await awaitTransaction(tx)
      return updated
    } finally {
      db.close()
    }
  },

  async listTranscripts(): Promise<VideoTranscriptRecord[]> {
    const db = await openDatabase()
    try {
      const tx = db.transaction(TRANSCRIPT_STORE, 'readonly')
      const store = tx.objectStore(TRANSCRIPT_STORE)
      const records = await awaitRequest<VideoTranscriptRecord[]>(store.getAll())
      await awaitTransaction(tx)
      return records
    } finally {
      db.close()
    }
  },

  async getTranscript(videoId: string): Promise<VideoTranscriptRecord | null> {
    const db = await openDatabase()
    try {
      const tx = db.transaction(TRANSCRIPT_STORE, 'readonly')
      const store = tx.objectStore(TRANSCRIPT_STORE)
      const record = await awaitRequest<VideoTranscriptRecord | undefined>(
        store.get(videoId),
      )
      await awaitTransaction(tx)
      return record ?? null
    } finally {
      db.close()
    }
  },

  async saveTranscript(record: VideoTranscriptRecord): Promise<void> {
    const db = await openDatabase()
    try {
      const tx = db.transaction(TRANSCRIPT_STORE, 'readwrite')
      tx.objectStore(TRANSCRIPT_STORE).put(record)
      await awaitTransaction(tx)
    } finally {
      db.close()
    }
  },

  async remove(id: string): Promise<void> {
    const db = await openDatabase()
    try {
      const tx = db.transaction(
        [VIDEO_STORE, BLOB_STORE, TRANSCRIPT_STORE],
        'readwrite',
      )
      tx.objectStore(VIDEO_STORE).delete(id)
      tx.objectStore(BLOB_STORE).delete(id)
      tx.objectStore(TRANSCRIPT_STORE).delete(id)
      await awaitTransaction(tx)
    } finally {
      db.close()
    }
  },
}
