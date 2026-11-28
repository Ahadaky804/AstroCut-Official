import { Film, FolderSearch, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  DeleteVideoModal,
  RenameVideoModal,
  VideoCard,
  VideoLibraryToolbar,
  VideoPreviewModal,
  VideoUploadZone,
} from '../components/library'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
} from '../components/ui'
import { useVideoLibrary } from '../context/VideoLibraryContext'
import type {
  VideoRecord,
  VideoSortOption,
  VideoTypeFilter,
} from '../types/video'
import { formatFileSize } from '../utils/videoFormat'

/**
 * Video Library page for uploading, searching, filtering, previewing, renaming, and deleting local videos.
 */
export function VideoLibraryPage() {
  const { videos, isLoading } = useVideoLibrary()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<VideoTypeFilter>('all')
  const [sortBy, setSortBy] = useState<VideoSortOption>('newest')
  const [showUploadPanel, setShowUploadPanel] = useState(true)

  const [previewVideo, setPreviewVideo] = useState<VideoRecord | null>(null)
  const [renameTarget, setRenameTarget] = useState<VideoRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VideoRecord | null>(null)

  const totalBytes = useMemo(
    () => videos.reduce((sum, item) => sum + item.sizeBytes, 0),
    [videos],
  )

  const filteredVideos = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const matching = videos.filter((video) => {
      const matchesType =
        typeFilter === 'all' || video.fileExtension === typeFilter
      const matchesTitle =
        normalizedQuery.length === 0 ||
        video.title.toLowerCase().includes(normalizedQuery)
      return matchesType && matchesTitle
    })

    return [...matching].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return (
            new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
          )
        case 'name-asc':
          return a.title.localeCompare(b.title)
        case 'name-desc':
          return b.title.localeCompare(a.title)
        case 'newest':
        default:
          return (
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          )
      }
    })
  }, [videos, searchQuery, typeFilter, sortBy])

  const hasActiveFilters = searchQuery.trim().length > 0 || typeFilter !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setTypeFilter('all')
    setSortBy('newest')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge variant="primary" dot>
            Local IndexedDB Storage
          </Badge>
        }
        title="Video Library"
        description="Upload, preview, and organize your MP4, MOV, and WebM video files locally."
        actions={
          <>
            <Badge variant="neutral" className="h-9 px-3 text-xs">
              {videos.length} {videos.length === 1 ? 'video' : 'videos'} ·{' '}
              {formatFileSize(totalBytes)}
            </Badge>
            <Button
              variant="primary"
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setShowUploadPanel((prev) => !prev)}
            >
              {showUploadPanel ? 'Hide Upload Area' : 'Upload New Video'}
            </Button>
          </>
        }
      />

      {showUploadPanel && (
        <Card
          title="Upload Video"
          subtitle="Select MP4, MOV, or WebM videos from your PC or mobile device."
        >
          <VideoUploadZone />
        </Card>
      )}

      <Card
        title="Stored Videos"
        subtitle="Search by title, filter by format, or manage uploaded video assets."
        headerAction={
          hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset filters
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-5">
          <VideoLibraryToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {isLoading ? (
            <LoadingState
              label="Loading Video Library..."
              description="Reading stored video metadata from IndexedDB."
            />
          ) : videos.length === 0 ? (
            <EmptyState
              icon={<Film className="h-5 w-5" aria-hidden="true" />}
              title="Your Video Library is empty"
              description="Upload your first MP4, MOV, or WebM video using the upload area above. Files are stored locally in your browser via IndexedDB."
              action={
                !showUploadPanel ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowUploadPanel(true)}
                  >
                    Upload Your First Video
                  </Button>
                ) : undefined
              }
            />
          ) : filteredVideos.length === 0 ? (
            <EmptyState
              icon={<FolderSearch className="h-5 w-5" aria-hidden="true" />}
              title="No matching videos"
              description="No videos match your current search query or format filter."
              action={
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear Search & Filters
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onPreview={setPreviewVideo}
                  onRename={setRenameTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <VideoPreviewModal
        video={previewVideo}
        onClose={() => setPreviewVideo(null)}
      />
      <RenameVideoModal
        video={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <DeleteVideoModal
        video={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
