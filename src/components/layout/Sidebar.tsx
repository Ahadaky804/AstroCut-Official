import { Clapperboard, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { APP_META, PRIMARY_NAV_ITEMS } from '../../config/navigation'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Responsive application sidebar providing primary route navigation.
 */
export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800/80 bg-slate-900/95 transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30">
              <Clapperboard className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="block text-sm font-semibold tracking-tight text-slate-100">
                {APP_META.name}
              </span>
              <span className="block text-xs text-slate-400">
                {APP_META.tagline}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 px-3 py-4">
          <p className="px-3 pb-1 text-xs font-medium tracking-wider text-slate-500 uppercase">
            Workspace
          </p>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-slate-800/80 p-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-200">
              {APP_META.phaseLabel}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Build v{APP_META.version} · Local Dev
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
