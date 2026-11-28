import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { aiClient } from '../services/aiClient'
import type {
  AiConnectionCheckResult,
  AiRoutingSettings,
  AiSystemSnapshot,
  ProviderId,
  ProviderPublicConfig,
  ProviderUpsertPayload,
} from '../types/ai'

interface AiProvidersContextValue {
  providers: ProviderPublicConfig[]
  routing: AiRoutingSettings | null
  isLoading: boolean
  error: string | null
  testingProviderId: ProviderId | null
  refreshingProviderId: ProviderId | null
  clearError: () => void
  refreshSnapshot: () => Promise<void>
  saveProvider: (payload: ProviderUpsertPayload) => Promise<void>
  deleteProvider: (id: ProviderId) => Promise<void>
  testConnection: (id: ProviderId) => Promise<AiConnectionCheckResult>
  refreshModels: (id: ProviderId) => Promise<void>
  updateRouting: (patch: Partial<AiRoutingSettings>) => Promise<void>
}

const AiProvidersContext = createContext<AiProvidersContextValue | undefined>(
  undefined,
)

function getErrMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/**
 * Provides reactive multi-provider AI configuration and routing state backed by AstroCut's server API.
 */
export function AiProvidersProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AiSystemSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testingProviderId, setTestingProviderId] = useState<ProviderId | null>(
    null,
  )
  const [refreshingProviderId, setRefreshingProviderId] =
    useState<ProviderId | null>(null)

  useEffect(() => {
    let active = true
    void aiClient
      .getSystemSnapshot()
      .then((data) => {
        if (!active) return
        setSnapshot(data)
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(getErrMessage(err, 'Unable to load AI provider configuration.'))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const refreshSnapshot = useCallback(async () => {
    try {
      const data = await aiClient.getSystemSnapshot()
      setSnapshot(data)
      setError(null)
    } catch (err) {
      setError(getErrMessage(err, 'Failed to refresh AI provider snapshot.'))
    }
  }, [])

  const saveProvider = useCallback(async (payload: ProviderUpsertPayload) => {
    setError(null)
    try {
      const res = await aiClient.upsertProvider(payload)
      setSnapshot(res.snapshot)
    } catch (err) {
      const msg = getErrMessage(err, 'Failed to save provider settings.')
      setError(msg)
      throw new Error(msg, { cause: err })
    }
  }, [])

  const deleteProvider = useCallback(async (id: ProviderId) => {
    setError(null)
    try {
      const res = await aiClient.deleteProvider(id)
      setSnapshot(res.snapshot)
    } catch (err) {
      const msg = getErrMessage(err, 'Failed to remove provider.')
      setError(msg)
      throw new Error(msg, { cause: err })
    }
  }, [])

  const testConnection = useCallback(async (id: ProviderId) => {
    setTestingProviderId(id)
    setError(null)
    try {
      const res = await aiClient.testConnection(id)
      setSnapshot(res.snapshot)
      return res.result
    } catch (err) {
      const msg = getErrMessage(err, 'Connection test failed.')
      setError(msg)
      throw new Error(msg, { cause: err })
    } finally {
      setTestingProviderId(null)
    }
  }, [])

  const refreshModels = useCallback(async (id: ProviderId) => {
    setRefreshingProviderId(id)
    setError(null)
    try {
      const res = await aiClient.refreshModels(id)
      setSnapshot(res.snapshot)
    } catch (err) {
      const msg = getErrMessage(err, 'Failed to refresh models.')
      setError(msg)
      throw new Error(msg, { cause: err })
    } finally {
      setRefreshingProviderId(null)
    }
  }, [])

  const updateRouting = useCallback(async (patch: Partial<AiRoutingSettings>) => {
    setError(null)
    try {
      const res = await aiClient.updateRouting(patch)
      setSnapshot(res.snapshot)
    } catch (err) {
      const msg = getErrMessage(err, 'Failed to update AI routing settings.')
      setError(msg)
      throw new Error(msg, { cause: err })
    }
  }, [])

  const value = useMemo<AiProvidersContextValue>(
    () => ({
      providers: snapshot?.providers ?? [],
      routing: snapshot?.routing ?? null,
      isLoading,
      error,
      testingProviderId,
      refreshingProviderId,
      clearError,
      refreshSnapshot,
      saveProvider,
      deleteProvider,
      testConnection,
      refreshModels,
      updateRouting,
    }),
    [
      snapshot,
      isLoading,
      error,
      testingProviderId,
      refreshingProviderId,
      clearError,
      refreshSnapshot,
      saveProvider,
      deleteProvider,
      testConnection,
      refreshModels,
      updateRouting,
    ],
  )

  return (
    <AiProvidersContext.Provider value={value}>
      {children}
    </AiProvidersContext.Provider>
  )
}

/**
 * Accesses server-managed multi-provider AI configurations and routing settings.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAiProviders(): AiProvidersContextValue {
  const ctx = useContext(AiProvidersContext)
  if (!ctx) {
    throw new Error('useAiProviders must be used within an AiProvidersProvider')
  }
  return ctx
}
