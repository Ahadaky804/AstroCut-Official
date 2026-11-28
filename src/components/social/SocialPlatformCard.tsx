import {
  AlertTriangle,
  Calendar,
  ExternalLink,
  Info,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Unplug,
  UserCircle2,
} from 'lucide-react'
import { PLATFORM_META } from '../../config/studio'
import { useSocialAccounts } from '../../context/SocialAccountsContext'
import type {
  SocialConnectedAccountPublic,
  SocialConnectionStatus,
  SocialPlatformPublicOverview,
} from '../../types/social'
import { formatUploadDate } from '../../utils/videoFormat'
import { Badge, Button, Card, type BadgeVariant } from '../ui'

const CONNECTION_BADGE: Record<
  SocialConnectionStatus,
  { label: string; variant: BadgeVariant }
> = {
  connected: { label: 'Connected', variant: 'success' },
  disconnected: { label: 'Disconnected', variant: 'neutral' },
  expired: { label: 'Expired', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
  setup_required: { label: 'Setup Required', variant: 'warning' },
}

const ACCOUNT_BADGE: Record<
  SocialConnectedAccountPublic['status'],
  { label: string; variant: BadgeVariant }
> = {
  connected: { label: 'Connected', variant: 'success' },
  expired: { label: 'Expired', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
}

interface SocialPlatformCardProps {
  overview: SocialPlatformPublicOverview
  onRequestDisconnect: (
    account: SocialConnectedAccountPublic,
    platformName: string,
  ) => void
}

/**
 * Renders OAuth status, connected profile cards, minimum scopes, eligibility, and connect/reconnect/disconnect controls.
 */
export function SocialPlatformCard({
  overview,
  onRequestDisconnect,
}: SocialPlatformCardProps) {
  const { busyPlatform, busyConnectionId, connectPlatform, verifyConnection } =
    useSocialAccounts()

  const meta = PLATFORM_META[overview.platform]
  const PlatformIcon = meta.icon
  const statusMeta = CONNECTION_BADGE[overview.status]
  const isStartingOAuth = busyPlatform === overview.platform

  return (
    <Card
      title={overview.platformName}
      subtitle={overview.statusMessage}
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusMeta.variant} dot>
            {statusMeta.label}
          </Badge>
          <Button
            variant={overview.accounts.length > 0 ? 'outline' : 'primary'}
            size="sm"
            isLoading={isStartingOAuth}
            disabled={!overview.configured || isStartingOAuth}
            leftIcon={<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => void connectPlatform(overview.platform)}
          >
            {overview.accounts.length > 0 ? 'Add / Reconnect' : 'Connect'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-edge-subtle bg-elevated p-3 text-xs text-content-secondary">
          <PlatformIcon
            className="mt-0.5 h-4 w-4 shrink-0 text-accent"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-medium text-content-primary">
              Account Eligibility &amp; Review Requirements
            </p>
            <p>{overview.eligibilityNote}</p>
            <p className="text-content-muted">{overview.reviewRequirementNote}</p>
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-content-primary">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            <span>Requested Minimum Permissions (No Publishing Scopes Yet)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {overview.requestedScopes.map((scope) => (
              <Badge key={scope} variant="outline" className="font-mono text-[11px]">
                {scope}
              </Badge>
            ))}
          </div>
        </div>

        {!overview.configured && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-warning/35 bg-warning-soft p-3 text-xs text-warning"
          >
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">
                OAuth App Credentials Required in Server Environment
              </p>
              <p>
                Set{' '}
                <span className="font-mono font-semibold">
                  {overview.missingEnvVars.join(', ')}
                </span>{' '}
                in <span className="font-mono">.env.local</span> and register callback URI{' '}
                <span className="font-mono break-all">{overview.redirectUri}</span>.
              </p>
            </div>
          </div>
        )}

        {overview.accounts.length > 0 ? (
          <ul className="space-y-3">
            {overview.accounts.map((acc) => {
              const accBadge = ACCOUNT_BADGE[acc.status]
              const isBusyAcc = busyConnectionId === acc.connectionId
              return (
                <li
                  key={acc.connectionId}
                  className="space-y-3 rounded-xl border border-edge-subtle bg-elevated p-3.5 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {acc.profileImageUrl ? (
                        <img
                          src={acc.profileImageUrl}
                          alt={acc.accountName}
                          className="h-10 w-10 shrink-0 rounded-full border border-edge-subtle object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-edge-subtle bg-card text-content-muted">
                          <UserCircle2 className="h-5 w-5" aria-hidden="true" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-content-primary">
                            {acc.accountName}
                          </span>
                          <Badge variant={accBadge.variant} dot>
                            {accBadge.label}
                          </Badge>
                        </div>
                        <p className="truncate font-mono text-[11px] text-content-secondary">
                          {acc.usernameOrChannelId || acc.externalAccountId}
                          {acc.accountType ? ` · ${acc.accountType}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={isBusyAcc}
                        leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                        onClick={() => void verifyConnection(acc.connectionId)}
                      >
                        Verify
                      </Button>

                      {(acc.status === 'expired' || acc.status === 'error') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          isLoading={isStartingOAuth}
                          disabled={!overview.configured}
                          onClick={() => void connectPlatform(overview.platform)}
                        >
                          Reconnect
                        </Button>
                      )}

                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isBusyAcc}
                        leftIcon={<Unplug className="h-3.5 w-3.5" aria-hidden="true" />}
                        onClick={() =>
                          onRequestDisconnect(acc, overview.platformName)
                        }
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>

                  <p
                    className={
                      acc.status === 'error'
                        ? 'text-danger'
                        : acc.status === 'expired'
                          ? 'text-warning'
                          : 'text-content-secondary'
                    }
                  >
                    {acc.statusMessage}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-content-muted">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      <span>Connected {formatUploadDate(acc.connectedAt)}</span>
                    </span>
                    {acc.expiresAt && (
                      <span>Token expires {formatUploadDate(acc.expiresAt)}</span>
                    )}
                    <span>
                      Granted: {acc.grantedScopes.join(', ') || 'None'}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : overview.configured ? (
          <div className="flex items-center gap-2 rounded-xl border border-edge-subtle bg-elevated p-3 text-xs text-content-secondary">
            <Info className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <span>
              No {overview.platformName} account connected yet. Click Connect to authorize via official OAuth 2.0.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-edge-subtle bg-elevated p-3 text-xs text-content-muted">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>Not connected — waiting for OAuth client configuration.</span>
          </div>
        )}
      </div>
    </Card>
  )
}
