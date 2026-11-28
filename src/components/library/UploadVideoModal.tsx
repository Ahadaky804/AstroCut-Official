import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { VideoRecord } from '../../types/video'
import { Button, buttonStyles, Modal } from '../ui'
import { VideoUploadZone } from './VideoUploadZone'

interface UploadVideoModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Reusable upload modal allowing video uploads from the Dashboard or Video Library.
 */
export function UploadVideoModal({ isOpen, onClose }: UploadVideoModalProps) {
  const [uploadedCount, setUploadedCount] = useState(0)

  const handleClose = () => {
    setUploadedCount(0)
    onClose()
  }

  const handleUploaded = (records: VideoRecord[]) => {
    setUploadedCount((prev) => prev + records.length)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload New Video"
      description="Select an MP4, MOV, or WebM file to add to your local Video Library."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Close
          </Button>
          <Link
            to="/library"
            onClick={handleClose}
            className={buttonStyles({ variant: 'primary' })}
          >
            <span>Open Video Library</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </>
      }
    >
      <div className="space-y-3">
        <VideoUploadZone compact onUploadComplete={handleUploaded} />

        {uploadedCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-success/25 bg-success-soft px-3.5 py-2.5 text-xs font-medium text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {uploadedCount} {uploadedCount === 1 ? 'video' : 'videos'} saved to
              local Video Library.
            </span>
          </div>
        )}
      </div>
    </Modal>
  )
}
