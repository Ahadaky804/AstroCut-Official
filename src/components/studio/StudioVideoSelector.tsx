import { Clock, Film, HardDrive } from 'lucide-react'
import { useStudio } from '../../context/StudioContext'
import { useVideoLibrary } from '../../context/VideoLibraryContext'
import { formatDuration, formatFileSize } from '../../utils/videoFormat'
import { Badge, Card, Select } from '../ui'

/**
 * Allows selecting a video from Video Library and displays its metadata context.
 */
export function StudioVideoSelector() {
  const { videos } = useVideoLibrary()
  const { selectedVideoId, setSelectedVideoId } = useStudio()

  const selectedVideo = videos.find((v) => v.id === selectedVideoId) ?? videos[0]
  if (!selectedVideo) return null

  const formattedDuration = formatDuration(selectedVideo.durationSeconds)
  const formattedSize = formatFileSize(selectedVideo.sizeBytes)

  return (
    <Card
      title="Selected Video"
      subtitle="Choose a stored video from your Video Library to prepare platform copy."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <Select
            label="Source Video"
            value={selectedVideo.id}
            onChange={(event) => setSelectedVideoId(event.target.value)}
            options={videos.map((video) => ({
              value: video.id,
              label: `${video.title} (${video.fileExtension.toUpperCase()})`,
            }))}
            hint="Videos are loaded directly from your local Video Library."
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
              <Badge variant="outline" className="uppercase">
                {selectedVideo.fileExtension}
              </Badge>
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
    </Card>
  )
}
