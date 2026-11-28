export type StudioLanguage = 'english' | 'roman-urdu' | 'hinglish'

export type StudioPlatform = 'youtube' | 'instagram' | 'tiktok'

export type StudioPlatformSelection = StudioPlatform | 'multiple'

export type StudioTone =
  | 'professional'
  | 'funny'
  | 'dramatic'
  | 'engaging'
  | 'educational'

export type StudioSubTab = 'editor' | 'preview'

export type AiConnectionStatus =
  | 'disconnected'
  | 'checking'
  | 'connected'
  | 'error'

export interface YouTubeContent {
  title: string
  description: string
  keywords: string
  hashtags: string
}

export interface InstagramContent {
  caption: string
  hashtags: string
}

export interface TikTokContent {
  caption: string
  hashtags: string
}

export interface StudioDraftContent {
  youtube: YouTubeContent
  instagram: InstagramContent
  tiktok: TikTokContent
}

export interface StudioSettings {
  language: StudioLanguage
  platformSelection: StudioPlatformSelection
  tone: StudioTone
}
