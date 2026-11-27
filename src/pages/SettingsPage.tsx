import { Info, Shield } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { APP_META } from '../config/navigation'

/**
 * Minimal Phase 1 settings placeholder showing non-sensitive workspace metadata.
 */
export function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card
        title="Workspace Foundation"
        subtitle="Non-sensitive application metadata for Phase 1."
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <dt className="text-xs font-medium text-slate-400">Application</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-100">
              {APP_META.name}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <dt className="text-xs font-medium text-slate-400">Phase</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-100">
              {APP_META.phaseLabel}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <dt className="text-xs font-medium text-slate-400">Version</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-100">
              v{APP_META.version}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Phase Boundary & Security Baseline">
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
            <p>
              External service endpoints, local AI models, media tools, and
              account integrations are intentionally omitted in Phase 1.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <p>
              No credentials, API tokens, or placeholder social connections are
              stored in client source code.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
