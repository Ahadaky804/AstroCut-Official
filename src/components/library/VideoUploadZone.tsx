import { AlertCircle, Upload, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useVideoLibrary } from '../../context/VideoLibraryContext'
import type { VideoRecord } from '../../types/video'
import { cn } from '../../utils/cn'
import { ACCEPTED_VIDEO_INPUT } from '../../utils/videoFormat'
import { Badge, Button } from '../ui'

interface VideoUploadZoneProps {
  compact?: boolean
  onUploadComplete?: (uploaded: VideoRecord[]) => void
}

/**
 * Drag-and-drop and file-picker upload zone supporting MP4, MOV, and WebM videos stored in IndexedDB.
 */
export function VideoUploadZone({
  compact = false,
  onUploadComplete,
}: VideoUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { isUploading, uploadProgress, error, clearError, uploadFiles } =
    useVideoLibrary()

  const handleSelectedFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const uploaded = await uploadFiles(files)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (uploaded.length > 0) {
      onUploadComplete?.(uploaded)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!isUploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (isUploading) return
    void handleSelectedFiles(event.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors duration-150',
          compact ? 'px-4 py-6' : 'px-6 py-8',
          isDragging
            ? 'border-accent bg-accent-soft'
            : 'border-edge-default bg-elevated/70 hover:border-edge-strong',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_VIDEO_INPUT}
          multiple
          onChange={(event) => void handleSelectedFiles(event.target.files)}
          className="sr-only"
          aria-label="Choose video files to upload"
        />

        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-accent">
          <Upload className="h-5 w-5" aria-hidden="true" />
        </div>

        <h3 className="text-sm font-semibold text-content-primary">
          {isDragging ? 'Drop videos to upload' : 'Upload videos to your local library'}
        </h3>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-content-secondary">
          Drag and drop video files here, or browse from your computer or mobile
          device. Stored locally in your browser via IndexedDB.
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <Badge variant="neutral">MP4</Badge>
          <Badge variant="neutral">MOV</Badge>
          <Badge variant="neutral">WebM</Badge>
        </div>

        <div className="mt-4">
          <Button
            variant="primary"
            size="md"
            isLoading={isUploading}
            leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? 'Saving Video...' : 'Select Video'}
          </Button>
        </div>
      </div>

      {uploadProgress && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-edge-subtle bg-card p-3.5"
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium text-content-primary">
              {uploadProgress.fileName}
            </span>
            <span className="shrink-0 font-semibold text-accent tabular-nums">
              {uploadProgress.percent}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full rounded-full bg-accent transition-all duration-200"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] capitalize text-content-secondary">
            {uploadProgress.stage}...
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs text-danger"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">{error}</p>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="rounded p-0.5 text-danger hover:bg-danger/15"
            aria-label="Dismiss upload error"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
