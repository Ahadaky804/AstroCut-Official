import {
  AlertCircle,
  ArrowRight,
  FileText,
  FolderSearch,
  Wand2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DeleteDraftModal,
  DraftCard,
  DraftsToolbar,
  RenameDraftModal,
} from '../components/drafts'
import {
  Badge,
  Button,
  buttonStyles,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
} from '../components/ui'
import { useDrafts } from '../context/DraftsContext'
import { useVideoLibrary } from '../context/VideoLibraryContext'
import type {
  ContentDraftRecord,
  DraftPlatformFilter,
  DraftSortOption,
  DraftStatusFilter,
} from '../types/draft'
import { filterAndSortDrafts } from '../utils/draftFilters'

/**
 * Draft Library page for searching, filtering, sorting, duplicating, renaming, and deleting saved drafts.
 */
export function DraftsPage() {
  const navigate = useNavigate()
  const { drafts, isLoading, error, clearError, duplicateDraft } = useDrafts()
  const { videos } = useVideoLibrary()

  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] =
    useState<DraftPlatformFilter>('all')
  const [statusFilter, setStatusFilter] = useState<DraftStatusFilter>('all')
  const [sortBy, setSortBy] = useState<DraftSortOption>('updated-desc')

  const [renameTarget, setRenameTarget] = useState<ContentDraftRecord | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<ContentDraftRecord | null>(
    null,
  )
  const [actionError, setActionError] = useState<string | null>(null)

  const videoTitlesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const v of videos) {
      map[v.id] = v.title
    }
    return map
  }, [videos])

  const filteredDrafts = useMemo(
    () =>
      filterAndSortDrafts(drafts, {
        searchQuery,
        platformFilter,
        statusFilter,
        sortBy,
        videoTitlesById,
      }),
    [drafts, searchQuery, platformFilter, statusFilter, sortBy, videoTitlesById],
  )

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    platformFilter !== 'all' ||
    statusFilter !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setPlatformFilter('all')
    setStatusFilter('all')
    setSortBy('updated-desc')
  }

  const handleDuplicate = async (draft: ContentDraftRecord) => {
    setActionError(null)
    try {
      const copy = await duplicateDraft(draft.id)
      navigate(`/drafts/${encodeURIComponent(copy.id)}`)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to duplicate draft.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge variant="primary" dot>
            IndexedDB Persistent Storage
          </Badge>
        }
        title="Draft Library"
        description="Review, edit, duplicate, organize, and approve your generated platform content drafts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" className="h-9 px-3 text-xs">
              {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
            </Badge>
            <Link
              to="/studio"
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              <span>AI Content Studio</span>
            </Link>
          </div>
        }
      />

      {(error || actionError) && (
        <div
          role="alert"
          className="flex items-start justify-between gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs text-danger"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{actionError || error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActionError(null)
              clearError()
            }}
          >
            Dismiss
          </Button>
        </div>
      )}

      <Card
        title="Saved Drafts"
        subtitle="Each draft stays linked to its source video and preserves platform-specific content separately."
        headerAction={
          hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset filters
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-5">
          <DraftsToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            platformFilter={platformFilter}
            onPlatformFilterChange={setPlatformFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {isLoading ? (
            <LoadingState
              label="Loading Draft Library..."
              description="Reading saved content drafts from IndexedDB."
            />
          ) : drafts.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" aria-hidden="true" />}
              title="No drafts saved yet"
              description="Generate or write platform copy in AI Content Studio to save persistent drafts locally."
              action={
                <Link
                  to="/studio"
                  className={buttonStyles({ variant: 'primary', size: 'md' })}
                >
                  <span>Open AI Content Studio</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              }
            />
          ) : filteredDrafts.length === 0 ? (
            <EmptyState
              icon={<FolderSearch className="h-5 w-5" aria-hidden="true" />}
              title="No matching drafts"
              description="No drafts match your current search, platform, or status filter."
              action={
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear Search & Filters
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDrafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  videoTitle={videoTitlesById[draft.videoId]}
                  onRename={setRenameTarget}
                  onDuplicate={(item) => void handleDuplicate(item)}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <RenameDraftModal
        draft={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <DeleteDraftModal
        draft={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
