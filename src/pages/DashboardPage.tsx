import { ArrowRight, Calendar } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GettingStartedSection,
  QuickActionsSection,
  RecentActivitySection,
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
import { useStudio } from '../context/StudioContext'
import { useVideoLibrary } from '../context/VideoLibraryContext'
import type {
  DashboardActivityItem,
  DashboardVideoItem,
  QuickActionItem,
} from '../types/dashboard'
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
 * AstroCut Dashboard integrated with real Video Library IndexedDB state.
 */
export function DashboardPage() {
  const navigate = useNavigate()
  const { videos } = useVideoLibrary()
  const { generatedCount } = useStudio()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const formattedDate = formatDashboardDate(new Date())

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
                : `${videos.length} ${videos.length === 1 ? 'video' : 'videos'} stored in Video Library`,
          }
        }
        if (stat.id === 'ai-generated') {
          return {
            ...stat,
            value: generatedCount,
            helperText:
              generatedCount === 0
                ? 'No AI generations run this session'
                : `${generatedCount} local Ollama ${generatedCount === 1 ? 'generation' : 'generations'} completed`,
          }
        }
        return stat
      }),
    [videos.length, generatedCount],
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

  const recentActivity = useMemo<DashboardActivityItem[]>(
    () =>
      videos.slice(0, 5).map((video) => ({
        id: `upload-${video.id}`,
        type: 'video_uploaded',
        title: 'Video uploaded',
        detail: `${video.title} (${video.fileExtension.toUpperCase()} · ${formatFileSize(video.sizeBytes)})`,
        timestamp: formatUploadDate(video.uploadedAt),
      })),
    [videos],
  )

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
        if (step.id === 'step-generate' && generatedCount > 0) {
          return {
            ...step,
            badgeLabel: 'Completed',
            badgeVariant: 'success' as const,
          }
        }
        return step
      }),
    [videos.length, generatedCount],
  )

  const handleQuickAction = (actionId: QuickActionItem['id']) => {
    if (actionId === 'upload-video') {
      setIsUploadModalOpen(true)
    } else if (actionId === 'open-library') {
      navigate('/library')
    } else if (actionId === 'create-ai-content') {
      navigate('/studio')
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
