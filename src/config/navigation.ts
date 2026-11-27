import {
  Boxes,
  Cpu,
  Film,
  Layers,
  LayoutDashboard,
  Palette,
  Settings,
  Share2,
  ShieldCheck,
} from 'lucide-react'
import type { FoundationStat, NavItem, PlannedModule } from '../types/navigation'

export const APP_META = {
  name: 'AstroCut',
  tagline: 'AI Video Studio',
  version: '0.2.0',
  phaseLabel: 'Phase 2 · Design System',
} as const

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    to: '/',
    icon: LayoutDashboard,
    description: 'Workspace overview and Phase 2 design system shell',
  },
  {
    id: 'settings',
    label: 'Settings',
    to: '/settings',
    icon: Settings,
    description: 'Appearance, theme preferences, and workspace info',
  },
]

export const FOUNDATION_STATS: FoundationStat[] = [
  {
    id: 'tokens',
    label: 'Design Tokens',
    value: 'Active',
    detail: 'CSS variable color system with dark-first and light theme support',
    icon: Palette,
  },
  {
    id: 'components',
    label: 'UI Component Kit',
    value: '11 Primitives',
    detail: 'Buttons, inputs, selects, modals, tooltips, cards, badges & states',
    icon: Layers,
  },
  {
    id: 'security',
    label: 'Workspace Hygiene',
    value: 'Verified',
    detail: 'Strict TypeScript, accessible focus states, zero mock integrations',
    icon: ShieldCheck,
  },
]

export const PLANNED_MODULES: PlannedModule[] = [
  {
    id: 'media-workspace',
    name: 'Media Workspace',
    description: 'Local project intake and structured video asset management.',
    stage: 'Later Phase',
    icon: Film,
  },
  {
    id: 'local-ai-engine',
    name: 'Local AI & Processing',
    description: 'Modular integration boundary for future local processing services.',
    stage: 'Later Phase',
    icon: Cpu,
  },
  {
    id: 'workflow-modules',
    name: 'Content Pipeline',
    description: 'Extensible architecture for clip preparation and metadata workflows.',
    stage: 'Later Phase',
    icon: Boxes,
  },
  {
    id: 'channel-adapters',
    name: 'Distribution Adapters',
    description: 'Future publishing and channel connectors with zero mock accounts.',
    stage: 'Later Phase',
    icon: Share2,
  },
]
