import { useState } from 'react'
import { useVideoLibrary } from '../../context/VideoLibraryContext'
import type { VideoRecord } from '../../types/video'
import { Button, Modal } from '../ui'

interface DeleteVideoModalProps {
  video: VideoRecord | null
  onClose: () => void
}

/**
 * Confirmation modal before permanently deleting a video from local IndexedDB storage.
 */
export function DeleteVideoModal({ video, onClose }: DeleteVideoModalProps) {
  const { deleteVideo } = useVideoLibrary()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    if (!video) return
    setIsDeleting(true)
    try {
      await deleteVideo(video.id)
      onClose()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Modal
      isOpen={Boolean(video)}
      onClose={onClose}
      title="Delete Video"
      description="This action permanently removes the video file and metadata from your local browser storage."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isDeleting}
            onClick={() => void handleConfirmDelete()}
          >
            Delete Video
          </Button>
        </>
      }
    >
      {video && (
        <div className="rounded-xl border border-edge-subtle bg-elevated p-3.5 text-xs text-content-secondary">
          <p className="font-semibold text-content-primary">{video.title}</p>
          <p className="mt-1 truncate">{video.fileName}</p>
        </div>
      )}
    </Modal>
  )
}
