import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Download,
  Languages,
  Save,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAiProviders } from '../../context/AiProvidersContext'
import { useVideoLibrary } from '../../context/VideoLibraryContext'
import { aiClient } from '../../services/aiClient'
import type {
  TranscriptSegment,
  TranscriptTransformMode,
  VideoTranscriptRecord,
} from '../../types/transcription'
import type { VideoRecord } from '../../types/video'
import { cn } from '../../utils/cn'
import {
  exportTranscriptToSrt,
  exportTranscriptToTxt,
  formatSegmentTimestamp,
} from '../../utils/transcriptExport'
import { Badge, Button, buttonStyles, Card, LoadingState, Textarea } from '../ui'

interface TranscriptEditorPanelProps {
  video: VideoRecord
  transcript: VideoTranscriptRecord
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Interactive video + timestamped transcript editor with video seeking,
 * segment persistence, TXT/SRT export, Roman Urdu transliteration, and optional English translation.
 */
export function TranscriptEditorPanel({
  video,
  transcript,
}: TranscriptEditorPanelProps) {
  const { getVideoBlob, saveEditedSegments, saveTranscriptTranslation } =
    useVideoLibrary()
  const { providers, routing } = useAiProviders()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isLoadingBlob, setIsLoadingBlob] = useState(true)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)

  const [draftSegments, setDraftSegments] = useState<TranscriptSegment[]>(
    transcript.segments,
  )
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false)
  const [isSavingEdits, setIsSavingEdits] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)

  const [transformLoadingMode, setTransformLoadingMode] =
    useState<TranscriptTransformMode | null>(null)
  const [transformError, setTransformError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    void getVideoBlob(video.id).then((blob) => {
      if (cancelled) return
      setIsLoadingBlob(false)
      if (!blob) {
        setPlaybackError(
          'Unable to load the video file from local IndexedDB storage.',
        )
        return
      }
      objectUrl = URL.createObjectURL(blob)
      setVideoUrl(objectUrl)
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [video.id, getVideoBlob])

  const seekToTimestamp = (seconds: number) => {
    const player = videoRef.current
    if (!player) return
    player.currentTime = Math.max(0, seconds)
    void player.play().catch(() => {
      // Autoplay after seek can be blocked cleanly without failing seek
    })
  }

  const handleSegmentChange = (index: number, nextText: string) => {
    setDraftSegments((prev) =>
      prev.map((seg, i) => (i === index ? { ...seg, text: nextText } : seg)),
    )
    setHasUnsavedEdits(true)
    setSaveFeedback(null)
  }

  const handleSaveSegments = async () => {
    setIsSavingEdits(true)
    setSaveFeedback(null)
    try {
      await saveEditedSegments(video.id, draftSegments)
      setHasUnsavedEdits(false)
      setSaveFeedback('Transcript segment edits saved locally.')
    } catch (err) {
      setSaveFeedback(
        err instanceof Error ? err.message : 'Failed to save transcript edits.',
      )
    } finally {
      setIsSavingEdits(false)
    }
  }

  const hasConfiguredAiProvider = providers.some(
    (p) =>
      p.enabled &&
      (!p.capabilities.requiresApiKey || p.hasApiKey) &&
      (p.defaultModel || p.discoveredModels.length > 0),
  )

  const handleRunTransform = async (mode: TranscriptTransformMode) => {
    setTransformLoadingMode(mode)
    setTransformError(null)
    try {
      const sourceText = exportTranscriptToTxt(draftSegments, {
        includeTimestamps: false,
        plainTextFallback: transcript.originalText,
      })

      const result = await aiClient.transformTranscript({
        mode,
        transcriptText: sourceText,
        sourceLanguage: transcript.detectedLanguage || transcript.languageCode,
        ...(routing?.mode === 'manual' && routing.defaultProviderId
          ? {
              providerId: routing.defaultProviderId,
              model: routing.defaultModel || undefined,
            }
          : {}),
      })

      await saveTranscriptTranslation(video.id, {
        ...(mode === 'roman_urdu'
          ? { romanUrduText: result.text }
          : { englishTranslationText: result.text }),
        translationProvider: `${result.providerName} (${result.model})`,
      })
    } catch (err) {
      setTransformError(
        err instanceof Error
          ? err.message
          : 'Unable to run AI transform. Check AI Provider Settings.',
      )
    } finally {
      setTransformLoadingMode(null)
    }
  }

  const handleCopyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      // Clipboard blocked cleanly
    }
  }

  const safeFileBase =
    video.title
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'transcript'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <Card
            title="Video Player & Metadata"
            subtitle="Click any segment timestamp to seek directly to that moment."
          >
            <div className="space-y-3.5">
              {isLoadingBlob ? (
                <LoadingState
                  compact
                  label="Loading video stream..."
                  description="Reading local media file from IndexedDB."
                />
              ) : playbackError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs text-danger"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{playbackError}</p>
                </div>
              ) : videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  className="aspect-video w-full rounded-xl border border-edge-subtle bg-black"
                />
              ) : null}

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="primary">
                  Language: {transcript.detectedLanguage || transcript.languageCode}
                </Badge>
                <Badge variant="outline">
                  Model: {transcript.modelSize}
                </Badge>
                <Badge variant="neutral">
                  Engine: {transcript.engineName} · {transcript.deviceUsed}
                </Badge>
              </div>

              {transcript.fallbackNote && (
                <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
                  {transcript.fallbackNote}
                </p>
              )}

              <Link
                to={`/studio?video=${encodeURIComponent(video.id)}`}
                className={buttonStyles({
                  variant: 'primary',
                  size: 'sm',
                  className: 'w-full justify-center',
                })}
              >
                <span>Open in AI Content Studio</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-7">
          <Card
            title="Timestamped Transcript Editor"
            subtitle="Original transcript is preserved with exact segment timestamps."
            headerAction={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() =>
                    downloadTextFile(
                      `${safeFileBase}.txt`,
                      exportTranscriptToTxt(draftSegments, {
                        includeTimestamps: true,
                        plainTextFallback: transcript.originalText,
                      }),
                      'text/plain;charset=utf-8',
                    )
                  }
                >
                  Export TXT
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() =>
                    downloadTextFile(
                      `${safeFileBase}.srt`,
                      exportTranscriptToSrt(draftSegments),
                      'application/x-subrip;charset=utf-8',
                    )
                  }
                >
                  Export SRT
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!hasUnsavedEdits}
                  isLoading={isSavingEdits}
                  leftIcon={<Save className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => void handleSaveSegments()}
                >
                  {hasUnsavedEdits ? 'Save Changes' : 'Saved'}
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              {saveFeedback && (
                <p className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">
                  {saveFeedback}
                </p>
              )}

              {draftSegments.length === 0 ? (
                <p className="text-xs text-content-secondary">
                  Whisper completed without detectable speech segments in this clip.
                </p>
              ) : (
                <div className="max-h-[56vh] space-y-2.5 overflow-y-auto pr-1">
                  {draftSegments.map((segment, index) => {
                    const isActive =
                      currentTime >= segment.startSeconds &&
                      currentTime <= segment.endSeconds
                    return (
                      <div
                        key={segment.id}
                        className={cn(
                          'rounded-xl border p-3 transition-colors',
                          isActive
                            ? 'border-accent bg-accent-soft/40'
                            : 'border-edge-subtle bg-elevated',
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => seekToTimestamp(segment.startSeconds)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-edge-default bg-card px-2.5 py-1 text-xs font-mono font-medium text-accent transition-colors hover:border-accent"
                            title="Seek video to this segment"
                          >
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            <span>
                              {formatSegmentTimestamp(segment.startSeconds)} →{' '}
                              {formatSegmentTimestamp(segment.endSeconds)}
                            </span>
                          </button>

                          <span className="text-[11px] text-content-muted">
                            Segment {index + 1}
                          </span>
                        </div>

                        <Textarea
                          aria-label={`Transcript segment ${index + 1} text`}
                          rows={2}
                          value={segment.text}
                          onChange={(e) =>
                            handleSegmentChange(index, e.target.value)
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Roman Urdu Transliteration & Optional English Translation"
        subtitle="Generated separately via your configured AI provider. Never replaces the original transcript."
        headerAction={
          !hasConfiguredAiProvider ? (
            <Link
              to="/providers"
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
            >
              Configure AI Provider
            </Link>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {transformError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{transformError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-edge-subtle bg-elevated p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-content-primary">
                    Roman Urdu Transliteration
                  </h4>
                </div>
                <div className="flex items-center gap-1.5">
                  {transcript.romanUrduText && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={
                        copiedKey === 'roman' ? (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        )
                      }
                      onClick={() =>
                        void handleCopyText('roman', transcript.romanUrduText!)
                      }
                    >
                      {copiedKey === 'roman' ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={
                      !hasConfiguredAiProvider || transformLoadingMode !== null
                    }
                    isLoading={transformLoadingMode === 'roman_urdu'}
                    onClick={() => void handleRunTransform('roman_urdu')}
                  >
                    {transcript.romanUrduText
                      ? 'Regenerate Roman Urdu'
                      : 'Generate Roman Urdu'}
                  </Button>
                </div>
              </div>

              <Textarea
                aria-label="Roman Urdu transliteration output"
                rows={6}
                readOnly
                value={transcript.romanUrduText ?? ''}
                placeholder="Click Generate Roman Urdu to transliterate your transcript using Latin script (preserves the original transcript above)."
              />
            </div>

            <div className="space-y-3 rounded-xl border border-edge-subtle bg-elevated p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-secondary" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-content-primary">
                    Optional English Translation
                  </h4>
                </div>
                <div className="flex items-center gap-1.5">
                  {transcript.englishTranslationText && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={
                        copiedKey === 'english' ? (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        )
                      }
                      onClick={() =>
                        void handleCopyText(
                          'english',
                          transcript.englishTranslationText!,
                        )
                      }
                    >
                      {copiedKey === 'english' ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={
                      !hasConfiguredAiProvider || transformLoadingMode !== null
                    }
                    isLoading={transformLoadingMode === 'english_translation'}
                    onClick={() =>
                      void handleRunTransform('english_translation')
                    }
                  >
                    {transcript.englishTranslationText
                      ? 'Re-translate to English'
                      : 'Translate to English'}
                  </Button>
                </div>
              </div>

              <Textarea
                aria-label="English translation output"
                rows={6}
                readOnly
                value={transcript.englishTranslationText ?? ''}
                placeholder="Optionally translate the original transcript into English using your configured AI provider."
              />
            </div>
          </div>

          {transcript.translationProvider && (
            <p className="text-xs text-content-muted">
              Generated with: {transcript.translationProvider}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
