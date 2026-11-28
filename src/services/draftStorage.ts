import type { ContentDraftRecord, DraftStatus } from '../types/draft'
import {
  awaitIdbRequest,
  awaitIdbTransaction,
  DRAFT_STORE,
  openAstroCutDatabase,
} from './indexedDb'

export interface DraftStorageRepository {
  list(): Promise<ContentDraftRecord[]>
  get(id: string): Promise<ContentDraftRecord | null>
  save(draft: ContentDraftRecord): Promise<ContentDraftRecord>
  duplicate(id: string): Promise<ContentDraftRecord>
  rename(id: string, name: string): Promise<ContentDraftRecord>
  updateStatus(id: string, status: DraftStatus): Promise<ContentDraftRecord>
  remove(id: string): Promise<void>
}

export function createDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function cloneDraftContent(
  content: ContentDraftRecord['content'],
): ContentDraftRecord['content'] {
  return {
    youtube: { ...content.youtube },
    instagram: { ...content.instagram },
    tiktok: { ...content.tiktok },
  }
}

export function createDraftStorage(
  idbFactory?: IDBFactory,
): DraftStorageRepository {
  const getDb = () => openAstroCutDatabase(idbFactory)

  return {
    async list(): Promise<ContentDraftRecord[]> {
      const db = await getDb()
      try {
        const tx = db.transaction(DRAFT_STORE, 'readonly')
        const store = tx.objectStore(DRAFT_STORE)
        const records = await awaitIdbRequest<ContentDraftRecord[]>(store.getAll())
        await awaitIdbTransaction(tx)
        return records.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
      } finally {
        db.close()
      }
    },

    async get(id: string): Promise<ContentDraftRecord | null> {
      const db = await getDb()
      try {
        const tx = db.transaction(DRAFT_STORE, 'readonly')
        const store = tx.objectStore(DRAFT_STORE)
        const record = await awaitIdbRequest<ContentDraftRecord | undefined>(
          store.get(id),
        )
        await awaitIdbTransaction(tx)
        return record ?? null
      } finally {
        db.close()
      }
    },

    async save(draft: ContentDraftRecord): Promise<ContentDraftRecord> {
      const trimmedName = draft.name.trim()
      if (!trimmedName) {
        throw new Error('Draft name cannot be empty.')
      }

      const now = new Date().toISOString()
      const recordToSave: ContentDraftRecord = {
        ...draft,
        name: trimmedName,
        content: cloneDraftContent(draft.content),
        platforms: [...draft.platforms],
        createdAt: draft.createdAt || now,
        updatedAt: now,
      }

      const db = await getDb()
      try {
        const tx = db.transaction(DRAFT_STORE, 'readwrite')
        tx.objectStore(DRAFT_STORE).put(recordToSave)
        await awaitIdbTransaction(tx)
        return recordToSave
      } catch (err) {
        if (err instanceof DOMException && err.name === 'QuotaExceededError') {
          throw new Error(
            'Browser storage quota exceeded while saving draft.',
            { cause: err },
          )
        }
        throw err instanceof Error
          ? err
          : new Error('Unable to save draft to local IndexedDB storage.')
      } finally {
        db.close()
      }
    },

    async duplicate(id: string): Promise<ContentDraftRecord> {
      const db = await getDb()
      try {
        const tx = db.transaction(DRAFT_STORE, 'readwrite')
        const store = tx.objectStore(DRAFT_STORE)
        const existing = await awaitIdbRequest<ContentDraftRecord | undefined>(
          store.get(id),
        )
        if (!existing) {
          throw new Error('Cannot duplicate: draft was not found in local storage.')
        }
        const now = new Date().toISOString()
        const copy: ContentDraftRecord = {
          ...existing,
          id: createDraftId(),
          name: `${existing.name} (Copy)`,
          content: cloneDraftContent(existing.content),
          platforms: [...existing.platforms],
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        }
        store.put(copy)
        await awaitIdbTransaction(tx)
        return copy
      } finally {
        db.close()
      }
    },

    async rename(id: string, name: string): Promise<ContentDraftRecord> {
      const trimmed = name.trim()
      if (!trimmed) {
        throw new Error('Draft name cannot be empty.')
      }

      const db = await getDb()
      try {
        const tx = db.transaction(DRAFT_STORE, 'readwrite')
        const store = tx.objectStore(DRAFT_STORE)
        const existing = await awaitIdbRequest<ContentDraftRecord | undefined>(
          store.get(id),
        )
        if (!existing) {
          throw new Error('Draft no longer exists in local storage.')
        }
        const updated: ContentDraftRecord = {
          ...existing,
          name: trimmed,
          updatedAt: new Date().toISOString(),
        }
        store.put(updated)
        await awaitIdbTransaction(tx)
        return updated
      } finally {
        db.close()
      }
    },

    async updateStatus(
      id: string,
      status: DraftStatus,
    ): Promise<ContentDraftRecord> {
      const db = await getDb()
      try {
        const tx = db.transaction(DRAFT_STORE, 'readwrite')
        const store = tx.objectStore(DRAFT_STORE)
        const existing = await awaitIdbRequest<ContentDraftRecord | undefined>(
          store.get(id),
        )
        if (!existing) {
          throw new Error('Draft no longer exists in local storage.')
        }
        const updated: ContentDraftRecord = {
          ...existing,
          status,
          updatedAt: new Date().toISOString(),
        }
        store.put(updated)
        await awaitIdbTransaction(tx)
        return updated
      } finally {
        db.close()
      }
    },

    async remove(id: string): Promise<void> {
      const db = await getDb()
      try {
        const tx = db.transaction(DRAFT_STORE, 'readwrite')
        tx.objectStore(DRAFT_STORE).delete(id)
        await awaitIdbTransaction(tx)
      } finally {
        db.close()
      }
    },
  }
}

export const indexedDbDraftStorage = createDraftStorage()
