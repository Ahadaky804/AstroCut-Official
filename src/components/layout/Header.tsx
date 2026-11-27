import { Menu, Moon, Sparkles, Sun } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { APP_META, PRIMARY_NAV_ITEMS } from '../../config/navigation'
import { useTheme } from '../../context/ThemeContext'
import { Badge, Button, Tooltip } from '../ui'

interface HeaderProps {
  isSidebarOpen: boolean
  onOpenSidebar: () => void
}

/**
 * Sticky top bar showing active route context, theme toggle, and mobile navigation trigger.
 */
export function Header({ isSidebarOpen, onOpenSidebar }: HeaderProps) {
  const { pathname } = useLocation()
  const { theme, toggleTheme } = useTheme()

  const activeRoute = PRIMARY_NAV_ITEMS.find((item) =>
    item.to === '/' ? pathname === '/' : pathname.startsWith(item.to),
  )

  const nextThemeLabel =
    theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-edge-subtle bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={onOpenSidebar}
          className="lg:hidden"
          aria-label="Open navigation menu"
          aria-expanded={isSidebarOpen}
          aria-controls="astrocut-sidebar"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-content-primary sm:text-base">
            {activeRoute?.label ?? 'Page Not Found'}
          </h1>
          <p className="hidden truncate text-xs text-content-secondary sm:block">
            {activeRoute?.description ?? 'Requested AstroCut route was not found'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <Tooltip content={nextThemeLabel} side="bottom">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={nextThemeLabel}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-warning" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-accent" aria-hidden="true" />
            )}
          </Button>
        </Tooltip>

        <Badge
          variant="primary"
          icon={<Sparkles className="h-3 w-3" aria-hidden="true" />}
          className="hidden sm:inline-flex"
        >
          {APP_META.phaseLabel}
        </Badge>
      </div>
    </header>
  )
}
