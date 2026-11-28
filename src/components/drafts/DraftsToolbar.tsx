import { Search } from 'lucide-react'
import type {
  DraftPlatformFilter,
  DraftSortOption,
  DraftStatusFilter,
} from '../../types/draft'
import { Input, Select } from '../ui'

interface DraftsToolbarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  platformFilter: DraftPlatformFilter
  onPlatformFilterChange: (value: DraftPlatformFilter) => void
  statusFilter: DraftStatusFilter
  onStatusFilterChange: (value: DraftStatusFilter) => void
  sortBy: DraftSortOption
  onSortChange: (value: DraftSortOption) => void
}

/**
 * Provides search, platform filtering, status filtering, and sorting for the Draft Library.
 */
export function DraftsToolbar({
  searchQuery,
  onSearchChange,
  platformFilter,
  onPlatformFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
}: DraftsToolbarProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
      <div className="md:col-span-5">
        <Input
          aria-label="Search drafts"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by draft name, video, or title..."
          leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <div className="md:col-span-2">
        <Select
          aria-label="Filter by platform"
          value={platformFilter}
          onChange={(e) =>
            onPlatformFilterChange(e.target.value as DraftPlatformFilter)
          }
          options={[
            { value: 'all', label: 'All Platforms' },
            { value: 'youtube', label: 'YouTube' },
            { value: 'instagram', label: 'Instagram' },
            { value: 'tiktok', label: 'TikTok' },
            { value: 'multiple', label: 'Multi-Platform' },
          ]}
        />
      </div>

      <div className="md:col-span-3">
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) =>
            onStatusFilterChange(e.target.value as DraftStatusFilter)
          }
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'ready_for_review', label: 'Ready for Review' },
            { value: 'approved', label: 'Approved' },
          ]}
        />
      </div>

      <div className="md:col-span-2">
        <Select
          aria-label="Sort drafts"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as DraftSortOption)}
          options={[
            { value: 'updated-desc', label: 'Recently Updated' },
            { value: 'newest', label: 'Newest Created' },
            { value: 'oldest', label: 'Oldest Created' },
            { value: 'name-asc', label: 'Name (A–Z)' },
          ]}
        />
      </div>
    </div>
  )
}
