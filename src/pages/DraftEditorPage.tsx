import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Film,
  Loader2,
  PenLine,
  Save,
  Trash2,
  Wand2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DeleteDraftModal, RenameDraftModal } from '../components/drafts'
import {
  PlatformContentEditor,
  PlatformContentPreview,
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
  Textarea,
} from '../components/ui'
import {
  getActivePlatforms,
  STUDIO_LANGUAGE_OPTIONS,
  STUDIO_PLATFORM_OPTIONS,
  STUDIO_TONE_OPTIONS,
} from '../config/studio'
import { useDrafts } from '../context/DraftsContext'
import { useVideoLibrary } from '../context/VideoLibraryContext'
import { cloneDraftContent } from '../services/draftStorage'
import type { ContentDraftRecord, DraftStatus } from '../types/draft'
import type {
  InstagramContent,
  StudioLanguage,
  StudioPlatform,
  StudioPlatformSelection,
  StudioSubTab,
  StudioTone,
  TikTokContent,
  YouTubeContent,
} from '../types/studio'
import { cn } from '../utils/cn'
import { formatUploadDate } from '../utils/videoFormat'

const STATUS_OPTIONS: Array<{ value: DraftStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'approved', label: 'Approved' },
]

function DraftEditorWorkspace({ initialDraft }: { initialDraft: ContentDraftRecord }) {
  const navigate = useNavigate()
  const { saveDraft, duplicateDraft } = useDrafts()
  const { videos, transcriptsByVideoId } = useVideoLibrary()

  const [draft, setDraft] = useState<ContentDraftRecord>(() => ({
    ...initialDraft,
    content: cloneDraftContent(initialDraft.content),
    platforms: [...initialDraft.platforms],
  }))
  const [activeView, setActiveView] = useState<StudioSubTab>('editor')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [dirtyCount, setDirtyCount] = useState(0)

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveChainRef = useRef<Promise<ContentDraftRecord | null>>(
    Promise.resolve(null),
  )

  const sourceVideo = videos.find((v) => v.id === draft.videoId)
  const sourceTranscript = transcriptsByVideoId[draft.videoId]

  const persistNow = useCallback(
    (snapshot: ContentDraftRecord): Promise<ContentDraftRecord | null> => {
      const next = saveChainRef.current.then(async () => {
        setSaveStatus('saving')
        setSaveError(null)
        try {
          const saved = await saveDraft(snapshot)
          setDraft((prev) => ({
            ...prev,
            updatedAt: saved.updatedAt,
          }))
          setSaveStatus('saved')
          setSaveError(null)
          return saved
        } catch (err) {
          setSaveStatus('failed')
          setSaveError(
            err instanceof Error ? err.message : 'Unable to save draft edits.',
          )
          return null
        }
      })
      saveChainRef.current = next.catch(() => null)
      return next
    },
    [saveDraft],
  )

  useEffect(() => {
    if (dirtyCount === 0) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)

    autoSaveTimerRef.current = setTimeout(() => {
      void persistNow(draft)
    }, 650)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [dirtyCount, draft, persistNow])

  const updateField = (updater: (prev: ContentDraftRecord) => ContentDraftRecord) => {
    setDraft((prev) => updater(prev))
    setDirtyCount((c) => c + 1)
  }

  const handleDuplicate = async () => {
    try {
      const savedCurrent = await persistNow(draft)
      const targetId = savedCurrent?.id ?? draft.id
      const copy = await duplicateDraft(targetId)
      navigate(`/drafts/${encodeURIComponent(copy.id)}`)
    } catch (err) {
      setSaveStatus('failed')
      setSaveError(
        err instanceof Error ? err.message : 'Unable to duplicate draft.',
      )
    }
  }

  const handlePlatformClear = (platform: StudioPlatform) => {
    updateField((prev) => {
      const nextContent = cloneDraftContent(prev.content)
      if (platform === 'youtube') {
        nextContent.youtube = { title: '', description: '', keywords: '', hashtags: '' }
      } else {
        nextContent[platform] = { caption: '', hashtags: '' }
      }
      return { ...prev, content: nextContent }
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge variant="primary" dot>
            Draft Editor
          </Badge>
        }
        title={draft.name}
        description={`Associated video: ${sourceVideo?.title ?? 'Original video unavailable'} · Last saved ${formatUploadDate(draft.updatedAt)}`}
        actions={
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
              </Badge>
            )}
            {saveStatus === 'failed' && (
              <Badge variant="danger" dot>
                Save Failed
              </Badge>
            )}

            <Link
              to="/drafts"
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>All Drafts</span>
            </Link>

            <Link
              to={`/studio?draft=${encodeURIComponent(draft.id)}`}
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
            >
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Open in Studio</span>
            </Link>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => void handleDuplicate()}
            >
              Duplicate
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRenameOpen(true)}
            >
              Rename
            </Button>

            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => setIsDeleteOpen(true)}
            >
              Delete
            </Button>

            <Button
              variant="primary"
              size="sm"
              isLoading={saveStatus === 'saving'}
              leftIcon={<Save className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => {
                if (autoSaveTimerRef.current) {
                  clearTimeout(autoSaveTimerRef.current)
                  autoSaveTimerRef.current = null
                }
                void persistNow(draft)
              }}
            >
              Save Changes
            </Button>
          </div>
        }
      />

      {saveStatus === 'failed' && saveError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{saveError}</p>
        </div>
      )}

      <Card
        title="Draft Settings & Provenance"
        subtitle="Configure draft metadata, status, and view associated video/transcript details."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Input
              label="Draft Name"
              value={draft.name}
              onChange={(e) =>
                updateField((prev) => ({ ...prev, name: e.target.value }))
              }
            />

            <Select
              label="Status"
              value={draft.status}
              onChange={(e) =>
                updateField((prev) => ({
                  ...prev,
                  status: e.target.value as DraftStatus,
                }))
              }
              options={STATUS_OPTIONS}
            />

            <Select
              label="Target Platforms"
              value={draft.platformSelection}
              onChange={(e) => {
                const selection = e.target.value as StudioPlatformSelection
                updateField((prev) => ({
                  ...prev,
                  platformSelection: selection,
                  platforms: getActivePlatforms(selection),
                }))
              }}
              options={STUDIO_PLATFORM_OPTIONS}
            />

            <Select
              label="Language"
              value={draft.language}
              onChange={(e) =>
                updateField((prev) => ({
                  ...prev,
                  language: e.target.value as StudioLanguage,
                }))
              }
              options={STUDIO_LANGUAGE_OPTIONS}
            />

            <Select
              label="Tone"
              value={draft.tone}
              onChange={(e) =>
                updateField((prev) => ({
                  ...prev,
                  tone: e.target.value as StudioTone,
                }))
              }
              options={STUDIO_TONE_OPTIONS}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-edge-subtle bg-elevated px-3.5 py-2.5 text-xs text-content-secondary">
            <span className="inline-flex items-center gap-1.5 text-content-primary font-medium">
              <Film className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Video: {sourceVideo?.title ?? `Removed (${draft.videoId})`}
            </span>
            <span>·</span>
            <span>
              Transcript:{' '}
              {sourceTranscript
                ? `Saved (${sourceTranscript.detectedLanguage || sourceTranscript.languageCode})`
                : 'Not present'}
            </span>
            {draft.generationMeta && (
              <>
                <span>·</span>
                <span>
                  Generated by {draft.generationMeta.providerName} (
                  {draft.generationMeta.model})
                </span>
              </>
            )}
          </div>

          <Textarea
            label="Subtitles / Captions Snapshot"
            rows={4}
            value={draft.subtitlesText ?? ''}
            onChange={(e) =>
              updateField((prev) => ({
                ...prev,
                subtitlesText: e.target.value,
              }))
            }
            placeholder="Optional SRT or plain subtitles associated with this draft..."
          />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Draft editor view"
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
      </div>

      {activeView === 'editor' ? (
        <PlatformContentEditor
          platforms={draft.platforms}
          content={draft.content}
          onUpdateYouTube={(patch: Partial<YouTubeContent>) =>
            updateField((prev) => ({
              ...prev,
              content: {
                ...prev.content,
                youtube: { ...prev.content.youtube, ...patch },
              },
            }))
          }
          onUpdateInstagram={(patch: Partial<InstagramContent>) =>
            updateField((prev) => ({
              ...prev,
              content: {
                ...prev.content,
                instagram: { ...prev.content.instagram, ...patch },
              },
            }))
          }
          onUpdateTikTok={(patch: Partial<TikTokContent>) =>
            updateField((prev) => ({
              ...prev,
              content: {
                ...prev.content,
                tiktok: { ...prev.content.tiktok, ...patch },
              },
            }))
          }
          onClearPlatform={handlePlatformClear}
        />
      ) : (
        <PlatformContentPreview
          platforms={draft.platforms}
          content={draft.content}
          settings={{
            language: draft.language,
            platformSelection: draft.platformSelection,
            tone: draft.tone,
          }}
          video={sourceVideo}
        />
      )}

      <RenameDraftModal
        draft={isRenameOpen ? draft : null}
        onClose={() => setIsRenameOpen(false)}
      />
      <DeleteDraftModal
        draft={isDeleteOpen ? draft : null}
        onClose={() => setIsDeleteOpen(false)}
        onDeleted={() => navigate('/drafts')}
      />
    </div>
  )
}

/**
 * Route wrapper loading an individual saved draft cleanly from IndexedDB via DraftsContext.
 */
export function DraftEditorPage() {
  const { draftId } = useParams<{ draftId: string }>()
  const { drafts, isLoading } = useDrafts()

  if (isLoading) {
    return (
      <LoadingState
        label="Loading Draft..."
        description="Reading saved draft fields from local IndexedDB storage."
      />
    )
  }

  const found = drafts.find((d) => d.id === draftId)
  if (!found) {
    return (
      <EmptyState
        icon={<FileText className="h-5 w-5" aria-hidden="true" />}
        title="Draft not found"
        description="This draft may have been deleted or no longer exists in local IndexedDB storage."
        action={
          <Link
            to="/drafts"
            className={buttonStyles({ variant: 'primary', size: 'md' })}
          >
            <span>Return to Draft Library</span>
          </Link>
        }
      />
    )
  }

  return <DraftEditorWorkspace key={`${found.id}-${found.name}`} initialDraft={found} />
}
