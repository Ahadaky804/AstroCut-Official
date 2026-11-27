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
  tagline: 'AI Video Content Platform',
  version: '0.1.0',
  phaseLabel: 'Phase 1 · Foundation',
} as const

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    to: '/',
    icon: LayoutDashboard,
    description: 'Platform overview and Phase 1 foundation status',
  },
  {
    id: 'settings',
    label: 'Settings',
    to: '/settings',
    icon: Settings,
    description: 'Workspace configuration placeholder',
  },
]

export const FOUNDATION_STATS: FoundationStat[] = [
  {
    id: 'shell',
    label: 'Application Shell',
    value: 'Ready',
    detail: 'Responsive sidebar and main content layout active',
    icon: Layers,
  },
  {
    id: 'ui-stack',
    label: 'UI & Routing Stack',
    value: 'Configured',
    detail: 'React Router, Tailwind CSS, and Lucide icons wired',
    icon: Palette,
  },
  {
    id: 'security',
    label: 'Workspace Hygiene',
    value: 'Enforced',
    detail: 'Zero embedded secrets, strict TypeScript & ESLint',
    icon: ShieldCheck,
  },
]

export const PLANNED_MODULES: PlannedModule[] = [
  {
    id: 'media-workspace',
    name: 'Media Workspace',
    description: 'Local project intake and structured video asset management.',
    stage: 'Planned · Later Phase',
    icon: Film,
  },
  {
    id: 'local-ai-engine',
    name: 'Local AI & Processing',
    description: 'Modular integration boundary for future local processing services.',
    stage: 'Planned · Later Phase',
    icon: Cpu,
  },
  {
    id: 'workflow-modules',
    name: 'Content Pipeline',
    description: 'Extensible architecture for clip preparation and metadata workflows.',
    stage: 'Planned · Later Phase',
    icon: Boxes,
  },
  {
    id: 'channel-adapters',
    name: 'Distribution Adapters',
    description: 'Future publishing and channel connectors with zero mock accounts.',
    stage: 'Planned · Later Phase',
    icon: Share2,
  },
]
