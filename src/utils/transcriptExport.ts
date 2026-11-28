import type { TranscriptSegment } from '../types/transcription.ts'

export function formatSegmentTimestamp(seconds: number): string {
  const clamped = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const totalWhole = Math.floor(clamped)
  const hours = Math.floor(totalWhole / 3600)
  const mins = Math.floor((totalWhole % 3600) / 60)
  const secs = totalWhole % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function formatSrtTimestamp(seconds: number): string {
  const clampedMs = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 1000))
  const hours = Math.floor(clampedMs / 3_600_000)
  const mins = Math.floor((clampedMs % 3_600_000) / 60_000)
  const secs = Math.floor((clampedMs % 60_000) / 1000)
  const ms = clampedMs % 1000
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function joinSegmentsText(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => seg.text.trim())
    .filter(Boolean)
    .join('\n')
}

export function exportTranscriptToTxt(
  segments: TranscriptSegment[],
  options?: { includeTimestamps?: boolean; plainTextFallback?: string },
): string {
  const includeTimestamps = options?.includeTimestamps ?? false
  const nonEmpty = segments.filter((seg) => seg.text.trim().length > 0)

  if (nonEmpty.length === 0) {
    return (options?.plainTextFallback ?? '').trim()
  }

  if (!includeTimestamps) {
    return nonEmpty.map((seg) => seg.text.trim()).join('\n')
  }

  return nonEmpty
    .map(
      (seg) =>
        `[${formatSegmentTimestamp(seg.startSeconds)} -> ${formatSegmentTimestamp(seg.endSeconds)}] ${seg.text.trim()}`,
    )
    .join('\n')
}

export function exportTranscriptToSrt(segments: TranscriptSegment[]): string {
  const nonEmpty = segments.filter((seg) => seg.text.trim().length > 0)
  if (nonEmpty.length === 0) return ''

  return nonEmpty
    .map((seg, index) => {
      const safeStart = Math.max(0, seg.startSeconds)
      const safeEnd = Math.max(safeStart + 0.1, seg.endSeconds)
      return `${index + 1}\n${formatSrtTimestamp(safeStart)} --> ${formatSrtTimestamp(safeEnd)}\n${seg.text.trim()}`
    })
    .join('\n\n')
    .concat('\n')
}
