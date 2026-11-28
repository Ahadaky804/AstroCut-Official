import {
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Share2,
} from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DisconnectAccountModal,
  SocialPlatformCard,
} from '../components/social'
import {
  Badge,
  Button,
  Card,
  LoadingState,
  PageHeader,
} from '../components/ui'
import { useSocialAccounts } from '../context/SocialAccountsContext'
import type { SocialConnectedAccountPublic } from '../types/social'

/**
 * Social Accounts integration dashboard managing encrypted server-side OAuth connections
 * for YouTube, Instagram Professional accounts, and TikTok.
 */
export function SocialAccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    snapshot,
    platforms,
    isLoading,
    error,
    actionNotice,
    clearFeedback,
    refreshSnapshot,
  } = useSocialAccounts()

  const [disconnectTarget, setDisconnectTarget] = useState<{
    account: SocialConnectedAccountPublic
    platformName: string
  } | null>(null)

  const oauthStatus = searchParams.get('oauth_status')
  const oauthPlatform = searchParams.get('oauth_platform')
  const oauthAccount = searchParams.get('oauth_account')
  const oauthError = searchParams.get('oauth_error')

  const totalConnectedAccounts = platforms.reduce(
    (sum, p) => sum + p.accounts.filter((a) => a.status === 'connected').length,
    0,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge variant="primary" dot>
            Server-Side Encrypted OAuth
          </Badge>
        }
        title="Social Accounts"
        description="Connect YouTube, Instagram Professional, and TikTok accounts securely for profile verification (publishing starts in Phase 10)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" className="h-9 px-3 text-xs">
              {totalConnectedAccounts}{' '}
              {totalConnectedAccounts === 1 ? 'account' : 'accounts'} connected
            </Badge>
            <Button
              variant="outline"
              size="md"
              isLoading={isLoading}
              leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void refreshSnapshot()}
            >
              Refresh Status
            </Button>
          </div>
        }
      />

      {oauthStatus === 'connected' && oauthPlatform && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-success/35 bg-success-soft px-4 py-3 text-xs text-success"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Successfully connected {oauthPlatform}
              {oauthAccount ? ` (${oauthAccount})` : ''}.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            Dismiss
          </Button>
        </div>
      )}

      {oauthStatus === 'error' && oauthError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger/35 bg-danger-soft px-4 py-3 text-xs text-danger"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              {oauthPlatform ? `${oauthPlatform}: ` : ''}
              {oauthError}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            Dismiss
          </Button>
        </div>
      )}

      {(error || actionNotice) && (
        <div
          role={error ? 'alert' : 'status'}
          className={
            error
              ? 'flex items-start justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs text-danger'
              : 'flex items-start justify-between gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-xs text-success'
          }
        >
          <div className="flex items-start gap-2.5">
            {error ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <p>{error || actionNotice}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFeedback}>
            Dismiss
          </Button>
        </div>
      )}

      <Card padding="sm">
        <div className="flex flex-col justify-between gap-3 text-xs text-content-secondary sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5 sm:items-center">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent sm:mt-0" aria-hidden="true" />
            <p>
              OAuth client secrets, access tokens, and refresh tokens remain exclusively on the Node server using{' '}
              <span className="font-semibold text-content-primary">
                AES-256-GCM
              </span>{' '}
              encryption ({snapshot?.encryptionMode === 'env_key' ? 'ASTROCUT_ENCRYPTION_KEY env key' : 'local .astrocut/social.key'}). Zero tokens are stored in IndexedDB or localStorage.
            </p>
          </div>
          <Badge
            variant="outline"
            icon={<Share2 className="h-3 w-3" aria-hidden="true" />}
            className="shrink-0"
          >
            Read-only OAuth (Phase 9)
          </Badge>
        </div>
      </Card>

      {isLoading && platforms.length === 0 ? (
        <LoadingState
          label="Checking Social Accounts..."
          description="Loading OAuth configuration and connected account status from server."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {platforms.map((overview) => (
            <SocialPlatformCard
              key={overview.platform}
              overview={overview}
              onRequestDisconnect={(account, platformName) =>
                setDisconnectTarget({ account, platformName })
              }
            />
          ))}
        </div>
      )}

      <DisconnectAccountModal
        account={disconnectTarget?.account ?? null}
        platformName={disconnectTarget?.platformName ?? ''}
        onClose={() => setDisconnectTarget(null)}
      />
    </div>
  )
}
