import { Menu, Sparkles } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { APP_META, PRIMARY_NAV_ITEMS } from '../../config/navigation'

interface HeaderProps {
  onOpenSidebar: () => void
}

/**
 * Top application bar displaying the current route context and mobile menu trigger.
 */
export function Header({ onOpenSidebar }: HeaderProps) {
  const { pathname } = useLocation()
  const activeRoute = PRIMARY_NAV_ITEMS.find((item) =>
    item.to === '/' ? pathname === '/' : pathname.startsWith(item.to),
  )

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-sm font-semibold text-slate-100 sm:text-base">
            {activeRoute?.label ?? 'Page Not Found'}
          </h1>
          <p className="hidden text-xs text-slate-400 sm:block">
            {activeRoute?.description ?? 'Requested AstroCut route was not found'}
          </p>
        </div>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{APP_META.phaseLabel}</span>
      </div>
    </header>
  )
}
