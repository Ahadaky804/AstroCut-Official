import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import type {
  TranscriptionStage,
  TranscriptionStatus,
} from '../../types/transcription'
import { cn } from '../../utils/cn'
import { Badge, Card } from '../ui'

interface TranscriptionProgressCardProps {
  status: TranscriptionStatus
  stage?: TranscriptionStage
  stageMessage?: string
  error?: string
}

const ORDERED_STAGES: Array<{ id: TranscriptionStage; label: string }> = [
  { id: 'preparing_audio', label: 'Preparing audio' },
  { id: 'loading_model', label: 'Loading transcription model' },
  { id: 'transcribing', label: 'Transcribing' },
  { id: 'saving_transcript', label: 'Saving transcript' },
  { id: 'completed', label: 'Completed' },
]

/**
 * Displays real server-reported transcription pipeline stages with an indeterminate activity bar
 * whenever an operation is running (never invents fake percentage progress).
 */
export function TranscriptionProgressCard({
  status,
  stage,
  stageMessage,
  error,
}: TranscriptionProgressCardProps) {
  if (status === 'not_transcribed') return null

  const activeIndex = ORDERED_STAGES.findIndex((s) => s.id === stage)
  const isBusy = status === 'waiting' || status === 'processing'

  return (
    <Card
      title="Transcription Progress"
      subtitle={
        stageMessage ||
        (status === 'waiting'
          ? 'Waiting in local queue...'
          : status === 'completed'
            ? 'Transcript saved locally in IndexedDB.'
            : status === 'failed'
              ? 'Processing stopped before completion.'
              : 'Processing locally on your machine...')
      }
      headerAction={
        <Badge
          variant={
            status === 'completed'
              ? 'success'
              : status === 'failed'
                ? 'danger'
                : 'primary'
          }
          dot
        >
          {status === 'waiting'
            ? 'Waiting'
            : status === 'processing'
              ? 'Processing'
              : status === 'completed'
                ? 'Completed'
                : 'Failed'}
        </Badge>
      }
    >
      <div className="space-y-4">
        {isBusy && (
          <div
            role="progressbar"
            aria-label="Transcription in progress"
            aria-valuetext={stageMessage || status}
            className="h-1.5 w-full overflow-hidden rounded-full bg-elevated"
          >
            <div className="h-full w-2/5 animate-pulse rounded-full bg-accent" />
          </div>
        )}

        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {ORDERED_STAGES.map((step, index) => {
            const isCompleted =
              status === 'completed' ||
              (activeIndex > index && status !== 'failed')
            const isCurrent =
              status !== 'completed' &&
              status !== 'failed' &&
              stage === step.id
            const isFailedHere = status === 'failed' && activeIndex === index

            return (
              <li
                key={step.id}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
                  isCompleted
                    ? 'border-success/30 bg-success-soft text-success'
                    : isCurrent
                      ? 'border-accent/40 bg-accent-soft text-accent'
                      : isFailedHere
                        ? 'border-danger/40 bg-danger-soft text-danger'
                        : 'border-edge-subtle bg-elevated text-content-muted',
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                ) : isFailedHere ? (
                  <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate font-medium">{step.label}</span>
              </li>
            )
          })}
        </ol>

        {status === 'failed' && error && (
          <p role="alert" className="text-xs leading-relaxed text-danger">
            {error}
          </p>
        )}
      </div>
    </Card>
  )
}
