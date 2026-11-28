export const ASTROCUT_DB_NAME = 'astrocut-media-db'
export const ASTROCUT_DB_VERSION = 3

export const VIDEO_STORE = 'videos'
export const BLOB_STORE = 'videoBlobs'
export const TRANSCRIPT_STORE = 'transcripts'
export const DRAFT_STORE = 'drafts'

export interface UpgradeableObjectStore {
  createIndex(
    name: string,
    keyPath: string,
    options?: { unique?: boolean },
  ): unknown
}

export interface UpgradeableDatabase {
  objectStoreNames: {
    contains(name: string): boolean
  }
  createObjectStore(
    name: string,
    options: { keyPath: string },
  ): UpgradeableObjectStore
}

/**
 * Additive schema upgrade preserving existing videos, blobs, and transcripts
 * while adding object stores introduced in later phases.
 */
export function upgradeAstroCutDatabase(db: UpgradeableDatabase): void {
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
  if (!db.objectStoreNames.contains(DRAFT_STORE)) {
    const store = db.createObjectStore(DRAFT_STORE, { keyPath: 'id' })
    store.createIndex('videoId', 'videoId', { unique: false })
    store.createIndex('updatedAt', 'updatedAt', { unique: false })
  }
}
