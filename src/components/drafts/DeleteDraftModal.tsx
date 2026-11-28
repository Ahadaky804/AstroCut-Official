import { useState } from 'react'
import { useDrafts } from '../../context/DraftsContext'
import type { ContentDraftRecord } from '../../types/draft'
import { Button, Modal } from '../ui'

interface DeleteDraftModalProps {
  draft: ContentDraftRecord | null
  onClose: () => void
  onDeleted?: () => void
}

/**
 * Confirmation modal before deleting a saved draft. Original videos and transcripts remain untouched.
 */
export function DeleteDraftModal({
  draft,
  onClose,
  onDeleted,
}: DeleteDraftModalProps) {
  const { deleteDraft } = useDrafts()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!draft) return
    setIsDeleting(true)
    try {
      await deleteDraft(draft.id)
      onClose()
      onDeleted?.()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Modal
      isOpen={Boolean(draft)}
      onClose={onClose}
      title="Delete Draft"
      description="This deletes the saved draft only. Your original video file and transcript remain safely preserved."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isDeleting}
            onClick={() => void handleConfirm()}
          >
            Delete Draft
          </Button>
        </>
      }
    >
      {draft && (
        <div className="rounded-xl border border-edge-subtle bg-elevated p-3.5 text-xs text-content-secondary">
          <p className="font-semibold text-content-primary">{draft.name}</p>
        </div>
      )}
    </Modal>
  )
}
