import { AlertTriangle, ArrowRight, Captions, Clock, Film, HardDrive } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStudio } from '../../context/StudioContext'
import { useVideoLibrary } from '../../context/VideoLibraryContext'
import { formatDuration, formatFileSize } from '../../utils/videoFormat'
import { Badge, buttonStyles, Card, Select, Textarea } from '../ui'

/**
 * Allows selecting a video from Video Library, inspects its saved transcript context, and captures extra notes.
 */
export function StudioVideoSelector() {
  const { videos, transcriptsByVideoId } = useVideoLibrary()
  const {
    selectedVideoId,
    setSelectedVideoId,
    videoContext,
    setVideoContext,
    isGenerating,
  } = useStudio()

  const selectedVideo = videos.find((v) => v.id === selectedVideoId) ?? videos[0]
  if (!selectedVideo) return null

  const transcript = transcriptsByVideoId[selectedVideo.id]
  const formattedDuration = formatDuration(selectedVideo.durationSeconds)
  const formattedSize = formatFileSize(selectedVideo.sizeBytes)

  return (
    <Card
      title="Selected Video & Transcript Context"
      subtitle="AI Content Studio grounds copywriting in your saved audio transcript (never claims visual video inspection)."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <Select
              label="Source Video"
              value={selectedVideo.id}
              disabled={isGenerating}
              onChange={(event) => setSelectedVideoId(event.target.value)}
              options={videos.map((video) => ({
                value: video.id,
                label: `${video.title} (${video.fileExtension.toUpperCase()})`,
              }))}
              hint="Video blobs remain local in IndexedDB; only text transcript context is sent for generation."
            />
          </div>

          <div className="flex flex-col gap-3.5 rounded-xl border border-edge-subtle bg-elevated p-3.5 sm:flex-row sm:items-center lg:col-span-7">
            <div className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-edge-subtle bg-card sm:w-36">
              {selectedVideo.thumbnailDataUrl ? (
                <img
                  src={selectedVideo.thumbnailDataUrl}
                  alt={selectedVideo.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Film className="h-6 w-6 text-content-muted" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="truncate text-sm font-semibold text-content-primary">
                  {selectedVideo.title}
                </h3>
                <div className="flex items-center gap-1.5">
                  <Badge variant={transcript ? 'success' : 'warning'} dot>
                    {transcript ? 'Transcript Saved' : 'Not Transcribed'}
                  </Badge>
                  <Badge variant="outline" className="uppercase">
                    {selectedVideo.fileExtension}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-content-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
                  <span>{formattedDuration ?? 'Duration unavailable'}</span>
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
                  <span>{formattedSize}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {transcript ? (
          <div className="space-y-2 rounded-xl border border-edge-subtle bg-elevated p-3.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-semibold text-content-primary">
                <Captions className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Saved Transcript Used for Generation (
                {transcript.detectedLanguage || transcript.languageCode} ·{' '}
                {transcript.segments.length}{' '}
                {transcript.segments.length === 1 ? 'segment' : 'segments'})
              </span>
              <Link
                to={`/transcribe?video=${encodeURIComponent(selectedVideo.id)}`}
                className="font-medium text-accent hover:underline"
              >
                Edit transcript →
              </Link>
            </div>
            <p className="line-clamp-3 whitespace-pre-line leading-relaxed text-content-secondary">
              {transcript.originalText}
            </p>
          </div>
        ) : (
          <div
            role="status"
            className="flex flex-col justify-between gap-3 rounded-xl border border-warning/35 bg-warning-soft p-3.5 text-xs sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-2.5 text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  No saved transcript for this video yet
                </p>
                <p className="opacity-90">
                  Transcribe the video first so AstroCut generates titles, descriptions, captions, and hashtags from its actual spoken content.
                </p>
              </div>
            </div>

            <Link
              to={`/transcribe?video=${encodeURIComponent(selectedVideo.id)}`}
              className={buttonStyles({
                variant: 'primary',
                size: 'sm',
                className: 'shrink-0',
              })}
            >
              <span>Transcribe First</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}

        <Textarea
          label="Additional Creator Notes (Optional Context)"
          rows={2}
          disabled={isGenerating}
          value={videoContext}
          onChange={(event) => setVideoContext(event.target.value)}
          placeholder="Optional audience hints, target links, or style emphasis to combine with your saved transcript..."
          hint="Combined with your saved transcript during generation without inventing visual claims."
        />
      </div>
    </Card>
  )
}
