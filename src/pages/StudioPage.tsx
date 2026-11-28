import {
  AlertCircle,
  ArrowRight,
  Eye,
  Film,
  Info,
  PenLine,
  RotateCcw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  StudioAiEnginePanel,
  StudioPlatformEditor,
  StudioPlatformPreview,
  StudioSettingsPanel,
  StudioVideoSelector,
} from '../components/studio'
import {
  Badge,
  Button,
  buttonStyles,
  EmptyState,
  LoadingState,
  PageHeader,
} from '../components/ui'
import { PLATFORM_LABELS } from '../config/studio'
import { useStudio } from '../context/StudioContext'
import { useVideoLibrary } from '../context/VideoLibraryContext'
import type { StudioPlatform } from '../types/studio'
import { cn } from '../utils/cn'

/**
 * AI Content Studio workspace for manual platform copywriting, configuration, and live previews.
 */
export function StudioPage() {
  const { videos, isLoading, error } = useVideoLibrary()
  const {
    selectedVideoId,
    activeView,
    setActiveView,
    focusedPlatform,
    setFocusedPlatform,
    activePlatforms,
    clearAllContent,
    content,
  } = useStudio()

  const selectedVideo = videos.find((v) => v.id === selectedVideoId) ?? videos[0]

  const visiblePlatforms: StudioPlatform[] =
    focusedPlatform !== 'all' && activePlatforms.includes(focusedPlatform)
      ? [focusedPlatform]
      : activePlatforms

  const hasAnyContent = Boolean(
    content.youtube.title ||
      content.youtube.description ||
      content.youtube.keywords ||
      content.youtube.hashtags ||
      content.instagram.caption ||
      content.instagram.hashtags ||
      content.tiktok.caption ||
      content.tiktok.hashtags,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge variant="primary" dot>
            Temporary Session Workspace
          </Badge>
        }
        title="AI Content Studio"
        description="Prepare platform-specific titles, descriptions, captions, keywords, and hashtags for your videos."
        actions={
          <Link
            to="/library"
            className={buttonStyles({ variant: 'outline', size: 'md' })}
          >
            <span>Video Library</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <StudioAiEnginePanel />

      {isLoading ? (
        <LoadingState
          label="Loading Studio workspace..."
          description="Checking your local Video Library for available videos."
        />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={<Film className="h-5 w-5" aria-hidden="true" />}
          title="No videos available yet"
          description="Upload a video in the Video Library first to select it as context in the AI Content Studio."
          action={
            <Link
              to="/library"
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              <span>Go to Video Library</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          }
        />
      ) : (
        <>
          <StudioVideoSelector />

          <StudioSettingsPanel />

          <div className="flex flex-col justify-between gap-3 rounded-xl border border-edge-subtle bg-card px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5 text-xs text-content-secondary sm:items-center">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-accent sm:mt-0"
                aria-hidden="true"
              />
              <p>
                Temporary workspace: edits stay in memory during your session,
                but permanent Draft Management arrives in Phase 8.
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              disabled={!hasAnyContent}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={clearAllContent}
            >
              Reset All Fields
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Studio workspace view"
              className="inline-flex rounded-xl border border-edge-subtle bg-card p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'editor'}
                onClick={() => setActiveView('editor')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors',
                  activeView === 'editor'
                    ? 'bg-accent text-on-accent'
                    : 'text-content-secondary hover:text-content-primary',
                )}
              >
                <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Content Editor</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'preview'}
                onClick={() => setActiveView('preview')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors',
                  activeView === 'preview'
                    ? 'bg-accent text-on-accent'
                    : 'text-content-secondary hover:text-content-primary',
                )}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Platform Previews</span>
              </button>
            </div>

            {activePlatforms.length > 1 && (
              <div
                aria-label="Filter active platforms"
                className="flex flex-wrap items-center gap-1.5"
              >
                <Button
                  variant={focusedPlatform === 'all' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setFocusedPlatform('all')}
                >
                  All ({activePlatforms.length})
                </Button>
                {activePlatforms.map((platform) => (
                  <Button
                    key={platform}
                    variant={
                      focusedPlatform === platform ? 'secondary' : 'outline'
                    }
                    size="sm"
                    onClick={() => setFocusedPlatform(platform)}
                  >
                    {PLATFORM_LABELS[platform]}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {activeView === 'editor' ? (
            <StudioPlatformEditor platforms={visiblePlatforms} />
          ) : (
            <StudioPlatformPreview
              platforms={visiblePlatforms}
              video={selectedVideo}
            />
          )}
        </>
      )}
    </div>
  )
}
