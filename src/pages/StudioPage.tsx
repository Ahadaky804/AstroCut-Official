import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  FilePlus2,
  Film,
  FolderOpen,
  Loader2,
  PenLine,
  RotateCcw,
  Save,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  Card,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from '../components/ui'
import { PLATFORM_LABELS } from '../config/studio'
import { useStudio } from '../context/StudioContext'
import { useVideoLibrary } from '../context/VideoLibraryContext'
import type { DraftStatus } from '../types/draft'
import type { StudioPlatform } from '../types/studio'
import { cn } from '../utils/cn'

const DRAFT_STATUS_OPTIONS: Array<{ value: DraftStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'approved', label: 'Approved' },
]

/**
 * AI Content Studio workspace with persistent IndexedDB Draft saving, auto-save, and live previews.
 */
export function StudioPage() {
  const [searchParams] = useSearchParams()
  const { videos, isLoading, error } = useVideoLibrary()
  const {
    selectedVideoId,
    setSelectedVideoId,
    activeView,
    setActiveView,
    focusedPlatform,
    setFocusedPlatform,
    activePlatforms,
    clearAllContent,
    content,
    activeDraftId,
    draftName,
    setDraftName,
    draftStatus,
    setDraftStatus,
    saveStatus,
    saveError,
    lastSavedAt,
    saveDraftNow,
    loadDraftById,
    startNewDraft,
  } = useStudio()

  const queryVideoId = searchParams.get('video')
  const queryDraftId = searchParams.get('draft')

  useEffect(() => {
    if (queryDraftId) {
      loadDraftById(queryDraftId)
      return
    }
    if (queryVideoId) {
      setSelectedVideoId(queryVideoId)
    }
  }, [queryDraftId, queryVideoId, loadDraftById, setSelectedVideoId])

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
            {activeDraftId ? 'Persistent Draft Synced' : 'AI Content Studio'}
          </Badge>
        }
        title="AI Content Studio"
        description="Generate, refine, auto-save, and manage platform-specific titles, captions, keywords, and hashtags."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/drafts"
              className={buttonStyles({ variant: 'outline', size: 'md' })}
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              <span>Draft Library</span>
            </Link>
            <Link
              to="/library"
              className={buttonStyles({ variant: 'outline', size: 'md' })}
            >
              <span>Video Library</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
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

          <Card
            title="Draft Persistence & Auto-Save"
            subtitle="Generated content and edits save persistently to IndexedDB while preserving your video and transcript association."
            headerAction={
              <div className="flex flex-wrap items-center gap-2">
                {saveStatus === 'saving' && (
                  <Badge
                    variant="secondary"
                    icon={<Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  >
                    Saving...
                  </Badge>
                )}
                {saveStatus === 'saved' && (
                  <Badge
                    variant="success"
                    icon={<CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                  >
                    Saved
                    {lastSavedAt
                      ? ` · ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </Badge>
                )}
                {saveStatus === 'failed' && (
                  <Badge variant="danger" dot>
                    Save Failed
                  </Badge>
                )}
                {saveStatus === 'idle' && (
                  <Badge variant="neutral">Not saved yet</Badge>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasAnyContent && !activeDraftId}
                  leftIcon={<FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={startNewDraft}
                >
                  New Draft
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={!selectedVideoId || saveStatus === 'saving'}
                  isLoading={saveStatus === 'saving'}
                  leftIcon={<Save className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => void saveDraftNow()}
                >
                  {activeDraftId ? 'Save Draft' : 'Save as Draft'}
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <Input
                    label="Draft Name"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder={
                      selectedVideo
                        ? `${selectedVideo.title} — Draft`
                        : 'Enter a name for this draft...'
                    }
                  />
                </div>

                <div className="sm:col-span-3">
                  <Select
                    label="Draft Status"
                    value={draftStatus}
                    onChange={(e) =>
                      setDraftStatus(e.target.value as DraftStatus)
                    }
                    options={DRAFT_STATUS_OPTIONS}
                  />
                </div>

                <div className="flex items-end sm:col-span-3">
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
              </div>

              {saveStatus === 'failed' && saveError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs text-danger"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{saveError}</p>
                </div>
              )}
            </div>
          </Card>

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
