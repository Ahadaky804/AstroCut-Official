import {
  Film,
  LayoutDashboard,
  Settings,
} from 'lucide-react'
import type { NavItem } from '../types/navigation'

export const APP_META = {
  name: 'AstroCut',
  tagline: 'AI Video Studio',
  version: '0.4.0',
  phaseLabel: 'Phase 4 · Video Library',
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
    id: 'settings',
    label: 'Settings',
    to: '/settings',
    icon: Settings,
    description: 'Appearance, theme preferences, and workspace info',
  },
]
