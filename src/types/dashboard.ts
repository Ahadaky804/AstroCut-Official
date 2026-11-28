import type { LucideIcon } from 'lucide-react'
import type { BadgeVariant } from '../components/ui'

export interface DashboardStatItem {
  id: 'total-videos' | 'drafts-saved' | 'drafts-review' | 'drafts-approved'
  label: string
  value: number
  helperText: string
  icon: LucideIcon
  accentTone: 'primary' | 'secondary' | 'neutral' | 'success'
}

export interface QuickActionItem {
  id:
    | 'upload-video'
    | 'create-ai-content'
    | 'open-library'
    | 'view-drafts'
  label: string
  description: string
  icon: LucideIcon
  available: boolean
  statusLabel: string
  targetPhase: string
}

export type VideoStatus = 'draft' | 'processing' | 'ready' | 'published'

export interface DashboardVideoItem {
  id: string
  title: string
  thumbnailUrl?: string
  uploadedAt: string
  duration?: string
  status: VideoStatus
}

export type DashboardActivityEventType =
  | 'video_uploaded'
  | 'ai_content_generated'
  | 'draft_saved'
  | 'video_published'

export interface DashboardActivityItem {
  id: string
  type: DashboardActivityEventType
  title: string
  detail: string
  timestamp: string
}

export interface OnboardingStep {
  stepNumber: number
  id: string
  title: string
  description: string
  availability: 'available' | 'planned'
  badgeLabel: string
  badgeVariant: BadgeVariant
}
