import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { Tooltip } from '../ui/Tooltip'

export interface NavItemProps {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  collapsed?: boolean
  badge?: string
  onClick?: () => void
}

/**
 * Reusable sidebar navigation item with active route indicator, collapsed tooltip, and keyboard focus styling.
 */
export function NavItem({
  to,
  label,
  icon: Icon,
  end = false,
  collapsed = false,
  badge,
  onClick,
}: NavItemProps) {
  const link = (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
          collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-3 px-3 py-2.5',
          isActive
            ? 'bg-accent-soft text-accent border border-accent/25 shadow-2xs'
            : 'border border-transparent text-content-secondary hover:bg-subtle hover:text-content-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span
              className="absolute top-2 bottom-2 left-0 w-0.5 rounded-r bg-accent"
              aria-hidden="true"
            />
          )}
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span className="truncate flex-1">{label}</span>}
          {!collapsed && badge && (
            <span className="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-content-muted">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip content={label} side="right">
        {link}
      </Tooltip>
    )
  }

  return link
}
