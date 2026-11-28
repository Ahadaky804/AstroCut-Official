import {
  CheckCircle2,
  FileText,
  Film,
  FolderOpen,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react'
import type {
  DashboardActivityItem,
  DashboardStatItem,
  DashboardVideoItem,
  OnboardingStep,
  QuickActionItem,
} from '../types/dashboard'

export const INITIAL_DASHBOARD_STATS: DashboardStatItem[] = [
  {
    id: 'total-videos',
    label: 'Total Videos',
    value: 0,
    helperText: 'No uploaded videos recorded yet',
    icon: Film,
    accentTone: 'primary',
  },
  {
    id: 'ai-generated',
    label: 'AI Content Generated',
    value: 0,
    helperText: 'No AI-generated items yet',
    icon: Sparkles,
    accentTone: 'secondary',
  },
  {
    id: 'drafts-saved',
    label: 'Drafts Saved',
    value: 0,
    helperText: 'No saved drafts yet',
    icon: FileText,
    accentTone: 'neutral',
  },
  {
    id: 'published-videos',
    label: 'Published Videos',
    value: 0,
    helperText: 'No published videos yet',
    icon: CheckCircle2,
    accentTone: 'success',
  },
]

export const QUICK_ACTIONS: QuickActionItem[] = [
  {
    id: 'upload-video',
    label: 'Upload New Video',
    description: 'Import source video footage into your workspace.',
    icon: Upload,
    available: false,
    statusLabel: 'Coming Soon',
    targetPhase: 'Planned for Video Library (Phase 4)',
  },
  {
    id: 'create-ai-content',
    label: 'Create AI Content',
    description: 'Generate titles, descriptions, and clip concepts.',
    icon: Wand2,
    available: false,
    statusLabel: 'Coming Soon',
    targetPhase: 'Planned for AI Content Studio (Phase 5)',
  },
  {
    id: 'open-library',
    label: 'Open Video Library',
    description: 'Browse and organize uploaded project media.',
    icon: FolderOpen,
    available: false,
    statusLabel: 'Coming Soon',
    targetPhase: 'Planned for Video Library (Phase 4)',
  },
  {
    id: 'view-drafts',
    label: 'View Saved Drafts',
    description: 'Review and refine prepared content drafts.',
    icon: FileText,
    available: false,
    statusLabel: 'Coming Soon',
    targetPhase: 'Planned for later phase',
  },
]

export const RECENT_VIDEOS: DashboardVideoItem[] = []

export const RECENT_ACTIVITY: DashboardActivityItem[] = []

export const GETTING_STARTED_STEPS: OnboardingStep[] = [
  {
    stepNumber: 1,
    id: 'step-upload',
    title: 'Upload your first video.',
    description: 'Add a video file once Video Library intake is enabled.',
    availability: 'planned',
    badgeLabel: 'Coming Soon · Phase 4',
    badgeVariant: 'neutral',
  },
  {
    stepNumber: 2,
    id: 'step-generate',
    title: 'Generate AI content.',
    description: 'Create video copy and metadata in the upcoming AI Content Studio.',
    availability: 'planned',
    badgeLabel: 'Coming Soon · Phase 5',
    badgeVariant: 'neutral',
  },
  {
    stepNumber: 3,
    id: 'step-draft',
    title: 'Save your draft.',
    description: 'Store work-in-progress edits and review copy before export.',
    availability: 'planned',
    badgeLabel: 'Planned',
    badgeVariant: 'neutral',
  },
  {
    stepNumber: 4,
    id: 'step-publish',
    title: 'Prepare your content for publishing.',
    description: 'Finalize deliverables for future distribution channels.',
    availability: 'planned',
    badgeLabel: 'Planned',
    badgeVariant: 'neutral',
  },
]
