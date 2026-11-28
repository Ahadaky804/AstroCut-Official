import {
  Captions,
  Cpu,
  FileText,
  Film,
  LayoutDashboard,
  Settings,
  Share2,
  Wand2,
} from 'lucide-react'
import type { NavItem } from '../types/navigation'

export const APP_META = {
  name: 'AstroCut',
  tagline: 'AI Video Studio',
  version: '0.9.0',
  phaseLabel: 'Phase 9 · Social Accounts',
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
    id: 'social',
    label: 'Social Accounts',
    to: '/social',
    icon: Share2,
    description: 'Connect YouTube, Instagram Professional, and TikTok via OAuth',
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
