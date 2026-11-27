import { ArrowRight, CheckCircle2, FolderTree } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import {
  APP_META,
  FOUNDATION_STATS,
  PLANNED_MODULES,
} from '../config/navigation'

/**
 * Phase 1 Dashboard placeholder presenting workspace foundation status and roadmap structure.
 */
export function DashboardPage() {
  return (
    <div className="space-y-6">
      <Card className="border-indigo-500/25 bg-linear-to-br from-slate-900 via-slate-900 to-indigo-950/40">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/25">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{APP_META.phaseLabel} Active</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
              Welcome to {APP_META.name}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
              Your modular React, Vite, TypeScript, and Tailwind CSS foundation is
              ready. This workspace intentionally stops at the Phase 1 shell so
              upcoming media, AI, and distribution modules can be built cleanly in
              later phases.
            </p>
          </div>

          <Link
            to="/settings"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:border-indigo-400/50 hover:bg-slate-800 sm:self-auto"
          >
            <span>Workspace Info</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FOUNDATION_STATS.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.id}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-indigo-400 ring-1 ring-slate-700/80">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-100">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {stat.detail}
                  </p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card
        title="Platform Architecture Placeholders"
        subtitle="Reserved module boundaries for upcoming AstroCut phases (not active in Phase 1)."
        headerAction={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs font-medium text-slate-300">
            <FolderTree className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>Scaffolded</span>
          </span>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {PLANNED_MODULES.map((module) => {
            const Icon = module.icon
            return (
              <div
                key={module.id}
                className="flex items-start gap-3.5 rounded-lg border border-slate-800/90 bg-slate-950/60 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-slate-400 ring-1 ring-slate-800">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-slate-200">
                      {module.name}
                    </h3>
                    <span className="rounded-full border border-slate-700/80 bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                      {module.stage}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    {module.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
