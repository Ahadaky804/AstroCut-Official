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
import { socialClient } from '../services/socialClient'
import type {
  SocialAccountsSnapshot,
  SocialPlatformId,
  SocialPlatformPublicOverview,
} from '../types/social'

interface SocialAccountsContextValue {
  snapshot: SocialAccountsSnapshot | null
  platforms: SocialPlatformPublicOverview[]
  isLoading: boolean
  error: string | null
  actionNotice: string | null
  busyPlatform: SocialPlatformId | null
  busyConnectionId: string | null
  clearFeedback: () => void
  refreshSnapshot: () => Promise<void>
  connectPlatform: (platform: SocialPlatformId) => Promise<void>
  verifyConnection: (connectionId: string) => Promise<void>
  disconnectConnection: (connectionId: string) => Promise<void>
}

const SocialAccountsContext = createContext<
  SocialAccountsContextValue | undefined
>(undefined)

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/**
 * Provides reactive OAuth connection status synced strictly with the encrypted Node backend.
 */
export function SocialAccountsProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SocialAccountsSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [busyPlatform, setBusyPlatform] = useState<SocialPlatformId | null>(
    null,
  )
  const [busyConnectionId, setBusyConnectionId] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    void socialClient
      .getSnapshot()
      .then((data) => {
        if (!mountedRef.current) return
        setSnapshot(data)
        setError(null)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        setError(
          getErrorMessage(err, 'Unable to load social account connections.'),
        )
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false)
      })

    return () => {
      mountedRef.current = false
    }
  }, [])

  const clearFeedback = useCallback(() => {
    setError(null)
    setActionNotice(null)
  }, [])

  const refreshSnapshot = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await socialClient.getSnapshot()
      if (!mountedRef.current) return
      setSnapshot(data)
      setError(null)
    } catch (err) {
      if (!mountedRef.current) return
      setError(
        getErrorMessage(err, 'Failed to refresh social account connections.'),
      )
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [])

  const connectPlatform = useCallback(async (platform: SocialPlatformId) => {
    setBusyPlatform(platform)
    setError(null)
    setActionNotice(null)
    try {
      const { authorizationUrl } = await socialClient.startOAuth(platform)
      window.location.assign(authorizationUrl)
    } catch (err) {
      const msg = getErrorMessage(
        err,
        `Unable to start ${platform} authorization flow.`,
      )
      if (mountedRef.current) setError(msg)
      setBusyPlatform(null)
    }
  }, [])

  const verifyConnection = useCallback(async (connectionId: string) => {
    setBusyConnectionId(connectionId)
    setError(null)
    setActionNotice(null)
    try {
      const res = await socialClient.verifyConnection(connectionId)
      if (!mountedRef.current) return
      setSnapshot(res.snapshot)
      setActionNotice(res.account.statusMessage)
    } catch (err) {
      if (!mountedRef.current) return
      setError(
        getErrorMessage(err, 'Unable to verify social account token status.'),
      )
      void socialClient.getSnapshot().then((latest) => {
        if (mountedRef.current) setSnapshot(latest)
      }).catch(() => undefined)
    } finally {
      if (mountedRef.current) setBusyConnectionId(null)
    }
  }, [])

  const disconnectConnection = useCallback(async (connectionId: string) => {
    setBusyConnectionId(connectionId)
    setError(null)
    setActionNotice(null)
    try {
      const res = await socialClient.disconnectConnection(connectionId)
      if (!mountedRef.current) return
      setSnapshot(res.snapshot)
      setActionNotice(
        res.note || 'Disconnected social account and removed local credentials.',
      )
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to disconnect social account.')
      if (mountedRef.current) setError(msg)
      throw new Error(msg, { cause: err })
    } finally {
      if (mountedRef.current) setBusyConnectionId(null)
    }
  }, [])

  const platforms = useMemo(
    () => snapshot?.platforms ?? [],
    [snapshot],
  )

  const value = useMemo<SocialAccountsContextValue>(
    () => ({
      snapshot,
      platforms,
      isLoading,
      error,
      actionNotice,
      busyPlatform,
      busyConnectionId,
      clearFeedback,
      refreshSnapshot,
      connectPlatform,
      verifyConnection,
      disconnectConnection,
    }),
    [
      snapshot,
      platforms,
      isLoading,
      error,
      actionNotice,
      busyPlatform,
      busyConnectionId,
      clearFeedback,
      refreshSnapshot,
      connectPlatform,
      verifyConnection,
      disconnectConnection,
    ],
  )

  return (
    <SocialAccountsContext.Provider value={value}>
      {children}
    </SocialAccountsContext.Provider>
  )
}

/**
 * Accesses server-managed Social Media OAuth connections and status.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSocialAccounts(): SocialAccountsContextValue {
  const ctx = useContext(SocialAccountsContext)
  if (!ctx) {
    throw new Error(
      'useSocialAccounts must be used within a SocialAccountsProvider',
    )
  }
  return ctx
}
