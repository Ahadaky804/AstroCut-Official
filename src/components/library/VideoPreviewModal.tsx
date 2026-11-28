import { AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useVideoLibrary } from '../../context/VideoLibraryContext'
import type { VideoRecord } from '../../types/video'
import {
  formatDuration,
  formatFileSize,
  formatUploadDate,
} from '../../utils/videoFormat'
import { Badge, Button, LoadingState, Modal } from '../ui'

interface VideoPreviewModalProps {
  video: VideoRecord | null
  onClose: () => void
}

function VideoPreviewBody({ video }: { video: VideoRecord }) {
  const { getVideoBlob } = useVideoLibrary()
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isLoadingBlob, setIsLoadingBlob] = useState(true)
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    void getVideoBlob(video.id).then((blob) => {
      if (cancelled) return
      setIsLoadingBlob(false)

      if (!blob) {
        setPlaybackError(
          'The video file could not be loaded from local IndexedDB storage.',
        )
        return
      }

      objectUrl = URL.createObjectURL(blob)
      setVideoUrl(objectUrl)
    })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [video.id, getVideoBlob])

  const formattedDuration = formatDuration(video.durationSeconds)

  return (
    <div className="space-y-4">
      {isLoadingBlob ? (
        <LoadingState
          compact
          label="Loading video preview..."
          description="Reading local media stream from IndexedDB."
        />
      ) : playbackError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-4 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{playbackError}</p>
        </div>
      ) : videoUrl ? (
        <video
          key={videoUrl}
          src={videoUrl}
          controls
          playsInline
          onError={() =>
            setPlaybackError(
              `Your browser cannot decode this ${video.fileExtension.toUpperCase()} codec for inline playback, though the file remains saved in your library.`,
            )
          }
          className="max-h-[58vh] w-full rounded-xl border border-edge-subtle bg-black"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
        <Badge variant="outline" className="uppercase">
          {video.fileExtension}
        </Badge>
        <Badge variant="neutral">{formatFileSize(video.sizeBytes)}</Badge>
        {formattedDuration && (
          <Badge variant="neutral">{formattedDuration}</Badge>
        )}
        <Badge variant="neutral">
          Uploaded {formatUploadDate(video.uploadedAt)}
        </Badge>
      </div>
    </div>
  )
}

/**
 * Loads the video Blob from IndexedDB and plays an HTML5 video preview inside a modal dialog.
 */
export function VideoPreviewModal({ video, onClose }: VideoPreviewModalProps) {
  return (
    <Modal
      isOpen={Boolean(video)}
      onClose={onClose}
      title={video?.title ?? 'Video Preview'}
      description={video?.fileName}
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          Close Preview
        </Button>
      }
    >
      {video && <VideoPreviewBody key={video.id} video={video} />}
    </Modal>
  )
}
