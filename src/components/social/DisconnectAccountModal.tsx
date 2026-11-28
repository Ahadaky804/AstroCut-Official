import { useState } from 'react'
import { useSocialAccounts } from '../../context/SocialAccountsContext'
import type { SocialConnectedAccountPublic } from '../../types/social'
import { Button, Modal } from '../ui'

interface DisconnectAccountModalProps {
  account: SocialConnectedAccountPublic | null
  platformName: string
  onClose: () => void
}

/**
 * Confirmation modal before revoking provider OAuth tokens and removing encrypted local credentials.
 */
export function DisconnectAccountModal({
  account,
  platformName,
  onClose,
}: DisconnectAccountModalProps) {
  const { disconnectConnection } = useSocialAccounts()
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const handleConfirm = async () => {
    if (!account) return
    setIsDisconnecting(true)
    try {
      await disconnectConnection(account.connectionId)
      onClose()
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <Modal
      isOpen={Boolean(account)}
      onClose={onClose}
      title={`Disconnect ${platformName}`}
      description="This attempts to revoke AstroCut's OAuth token with the platform (where supported) and permanently removes encrypted tokens from local server storage."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isDisconnecting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isDisconnecting}
            onClick={() => void handleConfirm()}
          >
            Disconnect Account
          </Button>
        </>
      }
    >
      {account && (
        <div className="rounded-xl border border-edge-subtle bg-elevated p-3.5 text-xs text-content-secondary">
          <p className="font-semibold text-content-primary">
            {account.accountName}
          </p>
          {account.usernameOrChannelId && (
            <p className="mt-1 font-mono text-[11px]">
              {account.usernameOrChannelId}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
