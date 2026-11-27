import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  to: string
  icon: LucideIcon
  description: string
}

export interface FoundationStat {
  id: string
  label: string
  value: string
  detail: string
  icon: LucideIcon
}

export interface PlannedModule {
  id: string
  name: string
  description: string
  stage: string
  icon: LucideIcon
}
