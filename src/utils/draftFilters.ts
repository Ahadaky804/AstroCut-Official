import type {
  ContentDraftRecord,
  DraftPlatformFilter,
  DraftSortOption,
  DraftStatus,
  DraftStatusFilter,
} from '../types/draft.ts'

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  draft: 'Draft',
  ready_for_review: 'Ready for Review',
  approved: 'Approved',
}

export function filterAndSortDrafts(
  drafts: ContentDraftRecord[],
  options: {
    searchQuery: string
    platformFilter: DraftPlatformFilter
    statusFilter: DraftStatusFilter
    sortBy: DraftSortOption
    videoTitlesById?: Record<string, string>
  },
): ContentDraftRecord[] {
  const query = options.searchQuery.trim().toLowerCase()

  const filtered = drafts.filter((draft) => {
    const matchesStatus =
      options.statusFilter === 'all' || draft.status === options.statusFilter

    const matchesPlatform =
      options.platformFilter === 'all' ||
      (options.platformFilter === 'multiple'
        ? draft.platformSelection === 'multiple' || draft.platforms.length > 1
        : draft.platforms.includes(options.platformFilter) ||
          draft.platformSelection === options.platformFilter)

    const videoTitle = options.videoTitlesById?.[draft.videoId] ?? ''
    const matchesSearch =
      query.length === 0 ||
      draft.name.toLowerCase().includes(query) ||
      draft.content.youtube.title.toLowerCase().includes(query) ||
      draft.content.instagram.caption.toLowerCase().includes(query) ||
      draft.content.tiktok.caption.toLowerCase().includes(query) ||
      videoTitle.toLowerCase().includes(query)

    return matchesStatus && matchesPlatform && matchesSearch
  })

  return [...filtered].sort((a, b) => {
    switch (options.sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'name-asc':
        return a.name.localeCompare(b.name)
      case 'updated-desc':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
  })
}

export function computeDashboardDraftMetrics(drafts: ContentDraftRecord[]) {
  const totalDrafts = drafts.length
  const awaitingReview = drafts.filter(
    (d) => d.status === 'ready_for_review',
  ).length
  const approvedDrafts = drafts.filter((d) => d.status === 'approved').length
  const recentDrafts = [...drafts]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 4)

  return {
    totalDrafts,
    awaitingReview,
    approvedDrafts,
    recentDrafts,
  }
}
