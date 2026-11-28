import { Search, X } from 'lucide-react'
import type { VideoSortOption, VideoTypeFilter } from '../../types/video'
import { Input, Select } from '../ui'

interface VideoLibraryToolbarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  typeFilter: VideoTypeFilter
  onTypeFilterChange: (value: VideoTypeFilter) => void
  sortBy: VideoSortOption
  onSortChange: (value: VideoSortOption) => void
}

/**
 * Search, file-type filter, and sorting controls for the Video Library.
 */
export function VideoLibraryToolbar({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortChange,
}: VideoLibraryToolbarProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
      <div className="md:col-span-6">
        <Input
          aria-label="Search videos by title"
          placeholder="Search videos by title..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
          rightElement={
            searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="rounded p-1 text-content-muted transition-colors hover:bg-subtle hover:text-content-primary"
                aria-label="Clear search query"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : undefined
          }
        />
      </div>

      <div className="sm:grid sm:grid-cols-2 sm:gap-3 md:col-span-6">
        <Select
          aria-label="Filter videos by file type"
          value={typeFilter}
          onChange={(event) =>
            onTypeFilterChange(event.target.value as VideoTypeFilter)
          }
          options={[
            { value: 'all', label: 'All Formats' },
            { value: 'mp4', label: 'MP4 (.mp4)' },
            { value: 'mov', label: 'MOV (.mov)' },
            { value: 'webm', label: 'WebM (.webm)' },
          ]}
        />

        <Select
          aria-label="Sort videos"
          value={sortBy}
          onChange={(event) =>
            onSortChange(event.target.value as VideoSortOption)
          }
          containerClassName="mt-3 sm:mt-0"
          options={[
            { value: 'newest', label: 'Sort: Newest First' },
            { value: 'oldest', label: 'Sort: Oldest First' },
            { value: 'name-asc', label: 'Sort: Name (A–Z)' },
            { value: 'name-desc', label: 'Sort: Name (Z–A)' },
          ]}
        />
      </div>
    </div>
  )
}
