import { ArrowRight, Calendar } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GettingStartedSection,
  QuickActionsSection,
  RecentActivitySection,
  RecentDraftsSection,
  RecentVideosSection,
  StatCardsGrid,
} from '../components/dashboard'
import { UploadVideoModal } from '../components/library'
import { Badge, buttonStyles, PageHeader } from '../components/ui'
import {
  GETTING_STARTED_STEPS,
  INITIAL_DASHBOARD_STATS,
  QUICK_ACTIONS,
} from '../config/dashboard'
import { APP_META } from '../config/navigation'
import { useDrafts } from '../context/DraftsContext'
import { useStudio } from '../context/StudioContext'
import { useVideoLibrary } from '../context/VideoLibraryContext'
import type {
  DashboardActivityItem,
  DashboardVideoItem,
  QuickActionItem,
} from '../types/dashboard'
import {
  computeDashboardDraftMetrics,
  DRAFT_STATUS_LABELS,
} from '../utils/draftFilters'
import {
  formatDuration,
  formatFileSize,
  formatUploadDate,
} from '../utils/videoFormat'

function formatDashboardDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/**
 * AstroCut Dashboard integrated with real Video Library, Transcript, and Draft IndexedDB state.
 */
export function DashboardPage() {
  const navigate = useNavigate()
  const { videos, transcriptsByVideoId } = useVideoLibrary()
  const { drafts } = useDrafts()
  const { generatedCount } = useStudio()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const formattedDate = formatDashboardDate(new Date())

  const transcribedCount = useMemo(
    () => Object.keys(transcriptsByVideoId).length,
    [transcriptsByVideoId],
  )

  const draftMetrics = useMemo(
    () => computeDashboardDraftMetrics(drafts),
    [drafts],
  )

  const videoTitlesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const v of videos) {
      map[v.id] = v.title
    }
    return map
  }, [videos])

  const stats = useMemo(
    () =>
      INITIAL_DASHBOARD_STATS.map((stat) => {
        if (stat.id === 'total-videos') {
          return {
            ...stat,
            value: videos.length,
            helperText:
              videos.length === 0
                ? 'No uploaded videos recorded yet'
                : `${videos.length} ${videos.length === 1 ? 'video' : 'videos'} stored (${transcribedCount} transcribed)`,
          }
        }
        if (stat.id === 'drafts-saved') {
          return {
            ...stat,
            value: draftMetrics.totalDrafts,
            helperText:
              draftMetrics.totalDrafts === 0
                ? 'No drafts stored in IndexedDB yet'
                : `${draftMetrics.totalDrafts} saved ${draftMetrics.totalDrafts === 1 ? 'draft' : 'drafts'} in Draft Library`,
          }
        }
        if (stat.id === 'drafts-review') {
          return {
            ...stat,
            value: draftMetrics.awaitingReview,
            helperText:
              draftMetrics.awaitingReview === 0
                ? 'No drafts waiting for review'
                : `${draftMetrics.awaitingReview} marked Ready for Review`,
          }
        }
        if (stat.id === 'drafts-approved') {
          return {
            ...stat,
            value: draftMetrics.approvedDrafts,
            helperText:
              draftMetrics.approvedDrafts === 0
                ? 'No approved drafts recorded yet'
                : `${draftMetrics.approvedDrafts} ${draftMetrics.approvedDrafts === 1 ? 'draft' : 'drafts'} approved`,
          }
        }
        return stat
      }),
    [videos.length, transcribedCount, draftMetrics],
  )

  const recentVideos = useMemo<DashboardVideoItem[]>(
    () =>
      videos.slice(0, 4).map((video) => ({
        id: video.id,
        title: video.title,
        thumbnailUrl: video.thumbnailDataUrl,
        uploadedAt: formatUploadDate(video.uploadedAt),
        duration: formatDuration(video.durationSeconds),
        status: video.status,
      })),
    [videos],
  )

  const recentActivity = useMemo<DashboardActivityItem[]>(() => {
    const events: Array<{ rawDate: number; item: DashboardActivityItem }> = []

    for (const video of videos.slice(0, 5)) {
      events.push({
        rawDate: new Date(video.uploadedAt).getTime(),
        item: {
          id: `upload-${video.id}`,
          type: 'video_uploaded',
          title: 'Video uploaded',
          detail: `${video.title} (${video.fileExtension.toUpperCase()} · ${formatFileSize(video.sizeBytes)})`,
          timestamp: formatUploadDate(video.uploadedAt),
        },
      })
    }

    for (const draft of drafts.slice(0, 5)) {
      events.push({
        rawDate: new Date(draft.updatedAt).getTime(),
        item: {
          id: `draft-${draft.id}`,
          type: 'draft_saved',
          title: 'Draft saved',
          detail: `${draft.name} (${DRAFT_STATUS_LABELS[draft.status]})`,
          timestamp: formatUploadDate(draft.updatedAt),
        },
      })
    }

    return events
      .sort((a, b) => b.rawDate - a.rawDate)
      .slice(0, 6)
      .map((entry) => entry.item)
  }, [videos, drafts])

  const onboardingSteps = useMemo(
    () =>
      GETTING_STARTED_STEPS.map((step) => {
        if (step.id === 'step-upload' && videos.length > 0) {
          return {
            ...step,
            badgeLabel: 'Completed',
            badgeVariant: 'success' as const,
          }
        }
        if (
          step.id === 'step-generate' &&
          (generatedCount > 0 || drafts.length > 0)
        ) {
          return {
            ...step,
            badgeLabel: 'Completed',
            badgeVariant: 'success' as const,
          }
        }
        if (step.id === 'step-draft' && drafts.length > 0) {
          return {
            ...step,
            badgeLabel: 'Completed',
            badgeVariant: 'success' as const,
          }
        }
        return step
      }),
    [videos.length, generatedCount, drafts.length],
  )

  const handleQuickAction = (actionId: QuickActionItem['id']) => {
    if (actionId === 'upload-video') {
      setIsUploadModalOpen(true)
    } else if (actionId === 'open-library') {
      navigate('/library')
    } else if (actionId === 'create-ai-content') {
      navigate('/studio')
    } else if (actionId === 'view-drafts') {
      navigate('/drafts')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge variant="primary" dot>
            {APP_META.phaseLabel}
          </Badge>
        }
        title="Welcome to AstroCut"
        description="Your AI-powered video content workspace."
        actions={
          <>
            <Badge
              variant="neutral"
              icon={<Calendar className="h-3.5 w-3.5" aria-hidden="true" />}
              className="h-9 px-3 text-xs"
            >
              {formattedDate}
            </Badge>
            <Link
              to="/drafts"
              className={buttonStyles({ variant: 'outline', size: 'md' })}
            >
              <span>Draft Library</span>
            </Link>
            <Link
              to="/library"
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              <span>Video Library</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </>
        }
      />

      <StatCardsGrid stats={stats} />

      <QuickActionsSection
        actions={QUICK_ACTIONS}
        onActionSelect={handleQuickAction}
      />

      <RecentDraftsSection
        drafts={draftMetrics.recentDrafts}
        videoTitlesById={videoTitlesById}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RecentVideosSection
          videos={recentVideos}
          onUploadClick={() => setIsUploadModalOpen(true)}
        />
        <RecentActivitySection activities={recentActivity} />
      </div>

      <GettingStartedSection steps={onboardingSteps} />

      <UploadVideoModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  )
}
