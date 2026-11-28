import {
  AlertCircle,
  ArrowRight,
  Captions,
  Film,
  Play,
  RotateCcw,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  EnvironmentStatusCard,
  TranscriptEditorPanel,
  TranscriptionProgressCard,
} from '../components/transcription'
import {
  Badge,
  Button,
  buttonStyles,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  Select,
} from '../components/ui'
import { useVideoLibrary } from '../context/VideoLibraryContext'
import type {
  TranscriptionLanguageCode,
  WhisperModelSize,
} from '../types/transcription'
import { formatDuration, formatFileSize } from '../utils/videoFormat'

const WHISPER_LANGUAGE_OPTIONS: Array<{
  value: TranscriptionLanguageCode
  label: string
}> = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'en', label: 'English (en)' },
  { value: 'ur', label: 'Urdu (ur)' },
  { value: 'hi', label: 'Hindi (hi)' },
  { value: 'pa', label: 'Punjabi (pa)' },
  { value: 'ar', label: 'Arabic (ar)' },
  { value: 'bn', label: 'Bengali (bn)' },
  { value: 'fa', label: 'Persian (fa)' },
  { value: 'tr', label: 'Turkish (tr)' },
  { value: 'es', label: 'Spanish (es)' },
  { value: 'fr', label: 'French (fr)' },
  { value: 'de', label: 'German (de)' },
  { value: 'pt', label: 'Portuguese (pt)' },
  { value: 'id', label: 'Indonesian (id)' },
  { value: 'ja', label: 'Japanese (ja)' },
  { value: 'ko', label: 'Korean (ko)' },
  { value: 'zh', label: 'Chinese (zh)' },
  { value: 'ru', label: 'Russian (ru)' },
]

const FALLBACK_MODEL_OPTIONS: Array<{
  value: WhisperModelSize
  label: string
}> = [
  { value: 'tiny', label: 'Tiny (~75 MB · Fastest)' },
  { value: 'base', label: 'Base (~145 MB · Balanced)' },
  { value: 'small', label: 'Small (~465 MB · Better Urdu/Hinglish)' },
  { value: 'medium', label: 'Medium (~1.5 GB · Heavy on CPU)' },
]

/**
 * Local-first Video Transcription & Timestamped Transcript Editor workspace.
 */
export function TranscribePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    videos,
    transcriptsByVideoId,
    activeJobsByVideoId,
    environment,
    isCheckingEnvironment,
    isLoading,
    refreshEnvironment,
    startTranscription,
  } = useVideoLibrary()

  const queryVideoId = searchParams.get('video') ?? ''
  const [modelSize, setModelSize] = useState<WhisperModelSize>('base')
  const [language, setLanguage] = useState<TranscriptionLanguageCode>('auto')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedVideo =
    videos.find((v) => v.id === queryVideoId) ?? videos[0]
  const selectedTranscript = selectedVideo
    ? transcriptsByVideoId[selectedVideo.id]
    : undefined
  const activeJob = selectedVideo
    ? activeJobsByVideoId[selectedVideo.id]
    : undefined

  const txStatus =
    selectedVideo?.transcriptionStatus ??
    (selectedTranscript ? 'completed' : 'not_transcribed')
  const isBusy = txStatus === 'waiting' || txStatus === 'processing' || isSubmitting

  const modelOptions = environment?.models.length
    ? environment.models.map((m) => ({
        value: m.id,
        label: `${m.label} (${m.approxSizeLabel})${m.downloaded ? ' · Cached' : ''}`,
      }))
    : FALLBACK_MODEL_OPTIONS

  const selectedModelMeta = environment?.models.find((m) => m.id === modelSize)
  const canStartLocalEngine = Boolean(
    environment?.ffmpegAvailable && environment?.whisperReady,
  )

  const handleSelectVideo = (nextId: string) => {
    setSearchParams({ video: nextId })
    setActionError(null)
  }

  const handleStartTranscription = async () => {
    if (!selectedVideo || isBusy) return
    setActionError(null)
    setIsSubmitting(true)
    try {
      await startTranscription(selectedVideo.id, modelSize, language)
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Unable to start local transcription.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge variant="primary" dot>
            Local FFmpeg + Whisper
          </Badge>
        }
        title="Video Transcription"
        description="Extract audio locally, transcribe speech with Whisper (CPU-safe), edit timestamped segments, and export TXT/SRT files."
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

      <EnvironmentStatusCard
        environment={environment}
        isChecking={isCheckingEnvironment}
        onRefresh={() => void refreshEnvironment()}
      />

      {isLoading ? (
        <LoadingState
          label="Loading Video Library..."
          description="Reading local videos and saved transcripts from IndexedDB."
        />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={<Film className="h-5 w-5" aria-hidden="true" />}
          title="No videos uploaded yet"
          description="Upload an MP4, MOV, or WebM video in Video Library first, then transcribe it locally here."
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
        selectedVideo && (
          <>
            <Card
              title="Transcription Controls"
              subtitle="Choose a video, Whisper model size, and spoken language. Models are only loaded when you run transcription."
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Select
                    label="Video"
                    value={selectedVideo.id}
                    disabled={isBusy}
                    onChange={(e) => handleSelectVideo(e.target.value)}
                    options={videos.map((v) => ({
                      value: v.id,
                      label: `${v.title} (${v.fileExtension.toUpperCase()})`,
                    }))}
                    hint={`${formatFileSize(selectedVideo.sizeBytes)}${formatDuration(selectedVideo.durationSeconds) ? ` · ${formatDuration(selectedVideo.durationSeconds)}` : ''}`}
                  />

                  <Select
                    label="Whisper Model Size"
                    value={modelSize}
                    disabled={isBusy}
                    onChange={(e) =>
                      setModelSize(e.target.value as WhisperModelSize)
                    }
                    options={modelOptions}
                    hint={
                      selectedModelMeta
                        ? `${selectedModelMeta.ramNote}${!selectedModelMeta.downloaded ? ' · Downloads only on first run.' : ' · Ready in local cache.'}`
                        : undefined
                    }
                  />

                  <Select
                    label="Spoken Language"
                    value={language}
                    disabled={isBusy}
                    onChange={(e) =>
                      setLanguage(e.target.value as TranscriptionLanguageCode)
                    }
                    options={WHISPER_LANGUAGE_OPTIONS}
                    hint="Original language is always preserved cleanly."
                  />
                </div>

                {modelSize === 'medium' && !selectedModelMeta?.downloaded && (
                  <p className="rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-xs text-warning">
                    Medium downloads ~1.5 GB on first run and can be very slow on CPU. Consider{' '}
                    <span className="font-semibold">Base</span> or{' '}
                    <span className="font-semibold">Small</span> for faster local runs.
                  </p>
                )}

                {actionError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs text-danger"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>{actionError}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge-subtle bg-elevated px-4 py-3">
                  <div className="flex items-center gap-2.5 text-xs text-content-secondary">
                    <Captions className="h-4 w-4 text-accent" aria-hidden="true" />
                    <span>
                      {selectedTranscript
                        ? 'A saved transcript exists for this video. You can edit it below or re-transcribe anytime.'
                        : 'Private video audio stays on your computer and temporary WAV files are deleted automatically.'}
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    isLoading={isBusy}
                    disabled={isBusy || (Boolean(environment) && !canStartLocalEngine)}
                    leftIcon={
                      txStatus === 'failed' || selectedTranscript ? (
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden="true" />
                      )
                    }
                    onClick={() => void handleStartTranscription()}
                  >
                    {isBusy
                      ? 'Transcribing...'
                      : txStatus === 'failed'
                        ? 'Retry Transcription'
                        : selectedTranscript
                          ? 'Re-transcribe Video'
                          : 'Start Transcription'}
                  </Button>
                </div>
              </div>
            </Card>

            <TranscriptionProgressCard
              status={txStatus}
              stage={activeJob?.stage ?? selectedVideo.transcriptionStage}
              stageMessage={activeJob?.stageMessage}
              error={activeJob?.error ?? selectedVideo.transcriptionError}
            />

            {selectedTranscript && (
              <TranscriptEditorPanel
                key={`${selectedVideo.id}-${selectedTranscript.transcribedAt}`}
                video={selectedVideo}
                transcript={selectedTranscript}
              />
            )}
          </>
        )
      )}
    </div>
  )
}
