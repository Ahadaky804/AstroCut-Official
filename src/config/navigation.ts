import {
  Captions,
  Cpu,
  FileText,
  Film,
  LayoutDashboard,
  Settings,
  Wand2,
} from 'lucide-react'
import type { NavItem } from '../types/navigation'

export const APP_META = {
  name: 'AstroCut',
  tagline: 'AI Video Studio',
  version: '0.8.0',
  phaseLabel: 'Phase 8 · Draft Management',
} as const

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    to: '/',
    icon: LayoutDashboard,
    description: 'Your AI-powered video content workspace',
  },
  {
    id: 'library',
    label: 'Video Library',
    to: '/library',
    icon: Film,
    description: 'Upload, preview, and organize local video assets',
  },
  {
    id: 'transcribe',
    label: 'Transcription',
    to: '/transcribe',
    icon: Captions,
    description: 'Extract audio and transcribe videos locally with Whisper',
  },
  {
    id: 'studio',
    label: 'AI Content Studio',
    to: '/studio',
    icon: Wand2,
    description: 'Prepare titles, descriptions, captions, keywords, and hashtags',
  },
  {
    id: 'drafts',
    label: 'Drafts',
    to: '/drafts',
    icon: FileText,
    description: 'Search, review, approve, and manage saved content drafts',
  },
  {
    id: 'providers',
    label: 'AI Providers',
    to: '/providers',
    icon: Cpu,
    description: 'Configure Gemini, OpenAI, Claude, Groq, Ollama, and custom APIs',
  },
  {
    id: 'settings',
    label: 'Settings',
    to: '/settings',
    icon: Settings,
    description: 'Appearance, theme preferences, and workspace info',
  },
]
