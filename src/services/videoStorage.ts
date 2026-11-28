import type { VideoRecord } from '../types/video'

const DB_NAME = 'astrocut-media-db'
const DB_VERSION = 1
const VIDEO_STORE = 'videos'
const BLOB_STORE = 'videoBlobs'

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

  async remove(id: string): Promise<void> {
    const db = await openDatabase()
    try {
      const tx = db.transaction([VIDEO_STORE, BLOB_STORE], 'readwrite')
      tx.objectStore(VIDEO_STORE).delete(id)
      tx.objectStore(BLOB_STORE).delete(id)
      await awaitTransaction(tx)
    } finally {
      db.close()
    }
  },
}
