import { Camera, Clapperboard, PlaySquare, type LucideIcon } from 'lucide-react'
import type { BadgeVariant, SelectOption } from '../components/ui'
import type {
  StudioDraftContent,
  StudioPlatform,
  StudioSettings,
} from '../types/studio'

export const STUDIO_LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'english', label: 'English' },
  { value: 'roman-urdu', label: 'Roman Urdu' },
  { value: 'hinglish', label: 'Hinglish' },
]

export const STUDIO_PLATFORM_OPTIONS: SelectOption[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'multiple', label: 'Multiple Platforms (All)' },
]

export const STUDIO_TONE_OPTIONS: SelectOption[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'funny', label: 'Funny' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'engaging', label: 'Engaging' },
  { value: 'educational', label: 'Educational' },
]

export const PLATFORM_LABELS: Record<StudioPlatform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
}

export const PLATFORM_META: Record<
  StudioPlatform,
  { label: string; icon: LucideIcon; badgeVariant: BadgeVariant }
> = {
  youtube: { label: 'YouTube', icon: PlaySquare, badgeVariant: 'danger' },
  instagram: { label: 'Instagram', icon: Camera, badgeVariant: 'primary' },
  tiktok: { label: 'TikTok', icon: Clapperboard, badgeVariant: 'secondary' },
}

export const PLATFORM_LIMITS = {
  youtubeTitle: 100,
  youtubeDescription: 5000,
  youtubeKeywords: 500,
  instagramCaption: 2200,
  tiktokCaption: 2200,
} as const

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  language: 'english',
  platformSelection: 'youtube',
  tone: 'engaging',
}

export function createEmptyStudioContent(): StudioDraftContent {
  return {
    youtube: {
      title: '',
      description: '',
      keywords: '',
      hashtags: '',
    },
    instagram: {
      caption: '',
      hashtags: '',
    },
    tiktok: {
      caption: '',
      hashtags: '',
    },
  }
}

export function getActivePlatforms(
  selection: StudioSettings['platformSelection'],
): StudioPlatform[] {
  if (selection === 'multiple') {
    return ['youtube', 'instagram', 'tiktok']
  }
  return [selection]
}
