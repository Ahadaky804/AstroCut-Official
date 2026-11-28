import {
  Clapperboard,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'
import { APP_META, PRIMARY_NAV_ITEMS } from '../../config/navigation'
import { cn } from '../../utils/cn'
import { Badge, Button, Tooltip } from '../ui'
import { NavItem } from './NavItem'

interface SidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

/**
 * Responsive AstroCut sidebar with refined branding, collapsible desktop mode, and mobile drawer.
 */
export function Sidebar({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-xs lg:hidden"
          style={{ backgroundColor: 'var(--overlay-backdrop)' }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="astrocut-sidebar"
        aria-label="Primary navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-edge-subtle bg-sidebar transition-all duration-200 ease-out',
          'lg:static lg:translate-x-0',
          isCollapsed ? 'w-64 lg:w-[4.5rem]' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-edge-subtle',
            isCollapsed ? 'justify-between px-4 lg:justify-center lg:px-2' : 'justify-between px-4',
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/35 bg-accent-soft text-accent shadow-xs">
              <Clapperboard className="h-4 w-4" aria-hidden="true" />
            </div>

            <div className={cn('min-w-0', isCollapsed && 'lg:hidden')}>
              <span className="block truncate text-sm font-semibold tracking-tight text-content-primary">
                {APP_META.name}
              </span>
              <span className="block truncate text-[11px] font-medium text-content-secondary">
                {APP_META.tagline}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          <p
            className={cn(
              'px-3 pb-1 text-[11px] font-semibold tracking-wider text-content-muted uppercase',
              isCollapsed && 'lg:hidden',
            )}
          >
            Workspace
          </p>

          {PRIMARY_NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              to={item.to}
              end={item.to === '/'}
              label={item.label}
              icon={item.icon}
              collapsed={isCollapsed}
              onClick={onClose}
            />
          ))}
        </nav>

        <div className="space-y-3 border-t border-edge-subtle p-3">
          {!isCollapsed && (
            <div className="rounded-xl border border-edge-subtle bg-elevated/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-content-primary">
                  Workspace
                </span>
                <Badge variant="primary">v{APP_META.version}</Badge>
              </div>
              <p className="mt-1 text-xs text-content-secondary">
                {APP_META.phaseLabel}
              </p>
            </div>
          )}

          <div
            className={cn(
              'hidden lg:flex',
              isCollapsed ? 'justify-center' : 'justify-end',
            )}
          >
            <Tooltip
              content={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              side={isCollapsed ? 'right' : 'top'}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </Tooltip>
          </div>
        </div>
      </aside>
    </>
  )
}
