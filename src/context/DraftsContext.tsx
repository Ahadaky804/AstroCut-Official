import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { indexedDbDraftStorage } from '../services/draftStorage'
import type { ContentDraftRecord, DraftStatus } from '../types/draft'

interface DraftsContextValue {
  drafts: ContentDraftRecord[]
  isLoading: boolean
  error: string | null
  clearError: () => void
  refreshDrafts: () => Promise<void>
  saveDraft: (draft: ContentDraftRecord) => Promise<ContentDraftRecord>
  duplicateDraft: (id: string) => Promise<ContentDraftRecord>
  renameDraft: (id: string, name: string) => Promise<ContentDraftRecord>
  updateDraftStatus: (
    id: string,
    status: DraftStatus,
  ) => Promise<ContentDraftRecord>
  deleteDraft: (id: string) => Promise<void>
}

const DraftsContext = createContext<DraftsContextValue | undefined>(undefined)

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function upsertInList(
  list: ContentDraftRecord[],
  item: ContentDraftRecord,
): ContentDraftRecord[] {
  const idx = list.findIndex((d) => d.id === item.id)
  const next = idx === -1 ? [item, ...list] : list.map((d) => (d.id === item.id ? item : d))
  return [...next].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

/**
 * Provides reactive Draft Management state synchronized with IndexedDB storage.
 */
export function DraftsProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<ContentDraftRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    void indexedDbDraftStorage
      .list()
      .then((records) => {
        if (!mountedRef.current) return
        setDrafts(records)
        setError(null)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        setError(
          getErrorMessage(err, 'Failed to load drafts from IndexedDB storage.'),
        )
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false)
      })

    return () => {
      mountedRef.current = false
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const refreshDrafts = useCallback(async () => {
    setIsLoading(true)
    try {
      const records = await indexedDbDraftStorage.list()
      if (!mountedRef.current) return
      setDrafts(records)
      setError(null)
    } catch (err) {
      if (!mountedRef.current) return
      setError(
        getErrorMessage(err, 'Failed to load drafts from IndexedDB storage.'),
      )
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [])

  const saveDraft = useCallback(async (draft: ContentDraftRecord) => {
    try {
      const saved = await indexedDbDraftStorage.save(draft)
      if (mountedRef.current) {
        setDrafts((prev) => upsertInList(prev, saved))
        setError(null)
      }
      return saved
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to save draft to IndexedDB.')
      if (mountedRef.current) setError(msg)
      throw new Error(msg, { cause: err })
    }
  }, [])

  const duplicateDraft = useCallback(async (id: string) => {
    try {
      const copy = await indexedDbDraftStorage.duplicate(id)
      if (mountedRef.current) {
        setDrafts((prev) => upsertInList(prev, copy))
        setError(null)
      }
      return copy
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to duplicate draft.')
      if (mountedRef.current) setError(msg)
      throw new Error(msg, { cause: err })
    }
  }, [])

  const renameDraft = useCallback(async (id: string, name: string) => {
    try {
      const updated = await indexedDbDraftStorage.rename(id, name)
      if (mountedRef.current) {
        setDrafts((prev) => upsertInList(prev, updated))
        setError(null)
      }
      return updated
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to rename draft.')
      if (mountedRef.current) setError(msg)
      throw new Error(msg, { cause: err })
    }
  }, [])

  const updateDraftStatus = useCallback(
    async (id: string, status: DraftStatus) => {
      try {
        const updated = await indexedDbDraftStorage.updateStatus(id, status)
        if (mountedRef.current) {
          setDrafts((prev) => upsertInList(prev, updated))
          setError(null)
        }
        return updated
      } catch (err) {
        const msg = getErrorMessage(err, 'Failed to update draft status.')
        if (mountedRef.current) setError(msg)
        throw new Error(msg, { cause: err })
      }
    },
    [],
  )

  const deleteDraft = useCallback(async (id: string) => {
    try {
      await indexedDbDraftStorage.remove(id)
      if (mountedRef.current) {
        setDrafts((prev) => prev.filter((d) => d.id !== id))
        setError(null)
      }
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to delete draft.')
      if (mountedRef.current) setError(msg)
      throw new Error(msg, { cause: err })
    }
  }, [])

  const value = useMemo<DraftsContextValue>(
    () => ({
      drafts,
      isLoading,
      error,
      clearError,
      refreshDrafts,
      saveDraft,
      duplicateDraft,
      renameDraft,
      updateDraftStatus,
      deleteDraft,
    }),
    [
      drafts,
      isLoading,
      error,
      clearError,
      refreshDrafts,
      saveDraft,
      duplicateDraft,
      renameDraft,
      updateDraftStatus,
      deleteDraft,
    ],
  )

  return (
    <DraftsContext.Provider value={value}>{children}</DraftsContext.Provider>
  )
}

/**
 * Accesses persistent Draft Management actions and IndexedDB state.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDrafts(): DraftsContextValue {
  const context = useContext(DraftsContext)
  if (!context) {
    throw new Error('useDrafts must be used within a DraftsProvider')
  }
  return context
}
