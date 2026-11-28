import { useState, type FormEvent } from 'react'
import { useVideoLibrary } from '../../context/VideoLibraryContext'
import type { VideoRecord } from '../../types/video'
import { Button, Input, Modal } from '../ui'

interface RenameVideoModalProps {
  video: VideoRecord | null
  onClose: () => void
}

function RenameVideoForm({
  video,
  onClose,
}: {
  video: VideoRecord
  onClose: () => void
}) {
  const { renameVideo } = useVideoLibrary()
  const [title, setTitle] = useState(video.title)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) {
      setFormError('Please enter a video title.')
      return
    }

    setIsSaving(true)
    setFormError(null)
    try {
      await renameVideo(video.id, trimmed)
      onClose()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to rename video.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      id="rename-video-form"
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-4"
    >
      <Input
        label="Video Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={formError ?? undefined}
        placeholder="Enter a clear video title"
        maxLength={120}
        autoFocus
      />

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-edge-subtle pt-4">
        <Button variant="ghost" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isSaving}>
          Save Title
        </Button>
      </div>
    </form>
  )
}

/**
 * Dialog for renaming a stored video title in IndexedDB.
 */
export function RenameVideoModal({ video, onClose }: RenameVideoModalProps) {
  return (
    <Modal
      isOpen={Boolean(video)}
      onClose={onClose}
      title="Rename Video"
      description="Update the display title for this video in your local library."
      size="sm"
    >
      {video && <RenameVideoForm key={video.id} video={video} onClose={onClose} />}
    </Modal>
  )
}
