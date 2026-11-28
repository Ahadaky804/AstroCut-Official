import { AlertTriangle, CheckCircle2, Cpu, RefreshCw, Terminal } from 'lucide-react'
import type { TranscriptionEnvironmentStatus } from '../../types/transcription'
import { Badge, Button, Card } from '../ui'

interface EnvironmentStatusCardProps {
  environment: TranscriptionEnvironmentStatus | null
  isChecking: boolean
  onRefresh: () => void
}

/**
 * Displays local FFmpeg, Python/Whisper runtime, cached model sizes, and safe CPU/GPU status.
 */
export function EnvironmentStatusCard({
  environment,
  isChecking,
  onRefresh,
}: EnvironmentStatusCardProps) {
  const ready = Boolean(environment?.ffmpegAvailable && environment?.whisperReady)

  return (
    <Card
      title="Local Processing Environment"
      subtitle="Zero-budget local audio extraction (FFmpeg) and speech-to-text (Whisper)."
      headerAction={
        <div className="flex items-center gap-2">
          <Badge variant={ready ? 'success' : 'warning'} dot>
            {ready ? 'Local Engine Ready' : 'Setup Needed'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            isLoading={isChecking}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onRefresh}
          >
            Re-check
          </Button>
        </div>
      }
    >
      {!environment ? (
        <p className="text-xs text-content-secondary">
          Checking local FFmpeg and Whisper installation...
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-edge-subtle bg-elevated p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-content-primary">FFmpeg</span>
                {environment.ffmpegAvailable ? (
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                )}
              </div>
              <p className="mt-1.5 text-content-secondary">
                {environment.ffmpegAvailable
                  ? environment.ffmpegVersion || 'FFmpeg available on system'
                  : environment.ffmpegError}
              </p>
            </div>

            <div className="rounded-xl border border-edge-subtle bg-elevated p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-content-primary">
                  Whisper Engine
                </span>
                {environment.whisperReady ? (
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                )}
              </div>
              <p className="mt-1.5 text-content-secondary">
                {environment.whisperReady
                  ? `Using local ${environment.whisperEngine}`
                  : environment.whisperError}
              </p>
            </div>

            <div className="rounded-xl border border-edge-subtle bg-elevated p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-content-primary">
                  Compute Device
                </span>
                <Cpu className="h-4 w-4 text-accent" aria-hidden="true" />
              </div>
              <p className="mt-1.5 text-content-secondary">
                {environment.computeDeviceSummary}
              </p>
            </div>
          </div>

          {!ready && (
            <div className="flex items-start gap-2.5 rounded-xl border border-edge-default bg-surface-raised p-3.5 text-xs text-content-secondary">
              <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-medium text-content-primary">
                  Windows 10 Local Setup Required
                </p>
                <p>
                  Install <span className="font-mono text-content-primary">ffmpeg</span> and Python{' '}
                  <span className="font-mono text-content-primary">faster-whisper</span> locally
                  (CPU mode works reliably without needing CUDA on Quadro P2000). See{' '}
                  <span className="font-mono text-content-primary">TRANSCRIPTION_SETUP.md</span>{' '}
                  in the project root for exact commands.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
