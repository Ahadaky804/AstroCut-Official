import { useState } from 'react'
import { useDrafts } from '../../context/DraftsContext'
import type { ContentDraftRecord } from '../../types/draft'
import { Button, Input, Modal } from '../ui'

interface RenameDraftModalProps {
  draft: ContentDraftRecord | null
  onClose: () => void
}

function RenameDraftForm({
  draft,
  onClose,
}: {
  draft: ContentDraftRecord
  onClose: () => void
}) {
  const { renameDraft } = useDrafts()
  const [name, setName] = useState(draft.name)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Draft name cannot be empty.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await renameDraft(draft.id, name.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rename draft.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <Input
        label="Draft Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error ?? undefined}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" isLoading={isSaving}>
          Save Name
        </Button>
      </div>
    </form>
  )
}

/**
 * Modal for renaming an existing saved draft cleanly in IndexedDB.
 */
export function RenameDraftModal({ draft, onClose }: RenameDraftModalProps) {
  return (
    <Modal
      isOpen={Boolean(draft)}
      onClose={onClose}
      title="Rename Draft"
      description="Update the display name for this saved draft."
      size="sm"
    >
      {draft && <RenameDraftForm key={draft.id} draft={draft} onClose={onClose} />}
    </Modal>
  )
}
