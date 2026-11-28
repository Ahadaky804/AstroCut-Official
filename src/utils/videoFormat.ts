import type { SupportedVideoExtension } from '../types/video'

const ALLOWED_EXTENSIONS: ReadonlySet<SupportedVideoExtension> = new Set([
  'mp4',
  'mov',
  'webm',
])

const MIME_TO_EXTENSION: Record<string, SupportedVideoExtension> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

export const ACCEPTED_VIDEO_INPUT =
  '.mp4,.mov,.webm,video/mp4,video/quicktime,video/webm'

export interface ValidatedVideoFile {
  extension: SupportedVideoExtension
  mimeType: string
  defaultTitle: string
}

/**
 * Validates that a user-selected file is a non-empty MP4, MOV, or WebM video.
 */
export function validateVideoFile(file: File): ValidatedVideoFile {
  if (file.size <= 0) {
    throw new Error(`"${file.name}" is empty and cannot be uploaded.`)
  }

  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? ''
  const extFromName = ALLOWED_EXTENSIONS.has(rawExt as SupportedVideoExtension)
    ? (rawExt as SupportedVideoExtension)
    : undefined
  const extFromMime = MIME_TO_EXTENSION[file.type.toLowerCase()]

  if (!extFromName && !extFromMime) {
    throw new Error(
      `"${file.name}" is not a supported format. Please select an MP4, MOV, or WebM video.`,
    )
  }

  if (file.type && !file.type.toLowerCase().startsWith('video/') && !extFromName) {
    throw new Error(
      `"${file.name}" has an unsupported file type (${file.type}).`,
    )
  }

  const extension = extFromMime ?? extFromName!
  const fallbackMime =
    extension === 'mov' ? 'video/quicktime' : `video/${extension}`

  return {
    extension,
    mimeType: file.type || fallbackMime,
    defaultTitle: stripFileExtension(file.name) || 'Untitled Video',
  }
}

/**
 * Removes the trailing file extension from a file name for display titles.
 */
export function stripFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot <= 0) return fileName.trim()
  return fileName.slice(0, lastDot).trim()
}

/**
 * Formats a byte count into human-readable units.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`
}

/**
 * Formats seconds into mm:ss or hh:mm:ss duration strings.
 */
export function formatDuration(seconds?: number): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return undefined
  }
  const totalSeconds = Math.floor(seconds)
  const hrs = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`
}

/**
 * Formats an ISO timestamp into a concise local upload date.
 */
export function formatUploadDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export interface ExtractedVideoMetadata {
  durationSeconds?: number
  thumbnailDataUrl?: string
}

/**
 * Extracts duration and a preview thumbnail frame in the browser when supported.
 */
export async function extractVideoMetadata(
  file: File,
): Promise<ExtractedVideoMetadata> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return {}
  }

  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true

  try {
    const metadataLoaded = await new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => resolve(false), 3500)

      video.onloadedmetadata = () => {
        window.clearTimeout(timer)
        resolve(true)
      }
      video.onerror = () => {
        window.clearTimeout(timer)
        resolve(false)
      }
      video.src = objectUrl
    })

    if (!metadataLoaded) {
      return {}
    }

    const durationSeconds =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : undefined

    let thumbnailDataUrl: string | undefined
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      const seekTime = durationSeconds ? Math.min(1, durationSeconds * 0.15) : 0
      const frameReady = await new Promise<boolean>((resolve) => {
        const timer = window.setTimeout(() => resolve(false), 2000)
        video.onseeked = () => {
          window.clearTimeout(timer)
          resolve(true)
        }
        video.onerror = () => {
          window.clearTimeout(timer)
          resolve(false)
        }
        try {
          video.currentTime = seekTime
        } catch {
          window.clearTimeout(timer)
          resolve(false)
        }
      })

      if (frameReady) {
        const targetWidth = 480
        const scale = targetWidth / video.videoWidth
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          try {
            thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.78)
          } catch {
            thumbnailDataUrl = undefined
          }
        }
      }
    }

    return { durationSeconds, thumbnailDataUrl }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}
