import {
  ArrowRight,
  CheckCircle2,
  FolderTree,
  Layers,
  LayoutGrid,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  buttonStyles,
  Card,
  EmptyState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  Tooltip,
} from '../components/ui'
import {
  APP_META,
  FOUNDATION_STATS,
  PLANNED_MODULES,
} from '../config/navigation'

/**
 * Phase 2 Dashboard placeholder showcasing the design system shell while reserving Phase 3 Dashboard implementation.
 */
export function DashboardPage() {
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [showLoadingPreview, setShowLoadingPreview] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge variant="success" dot>
            {APP_META.phaseLabel} Active
          </Badge>
        }
        title={`Welcome to ${APP_META.name}`}
        description="A dark-first, token-driven UI foundation for AstroCut. Phase 3 will populate this dashboard with operational workspace modules."
        actions={
          <>
            <Tooltip content="Inspect modal, input, and loading primitives">
              <Button
                variant="outline"
                leftIcon={<Layers className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setIsPreviewModalOpen(true)}
              >
                UI Kit Preview
              </Button>
            </Tooltip>
            <Link
              to="/settings"
              className={buttonStyles({ variant: 'primary' })}
            >
              <span>Appearance Settings</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FOUNDATION_STATS.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.id} variant="interactive">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-content-secondary">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-content-primary">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                    {stat.detail}
                  </p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <EmptyState
        icon={<LayoutGrid className="h-5 w-5" aria-hidden="true" />}
        title="Dashboard Workspace Reserved for Phase 3"
        description="Phase 2 establishes the visual design system, CSS variables, typography, theme support, and reusable UI primitives without adding premature dashboard logic."
        action={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => setIsPreviewModalOpen(true)}
          >
            Inspect Reusable Components
          </Button>
        }
      />

      <Card
        title="Reserved Platform Architecture"
        subtitle="Planned module boundaries intentionally kept inactive until their dedicated phases."
        headerAction={
          <Badge
            variant="outline"
            icon={<FolderTree className="h-3 w-3" aria-hidden="true" />}
          >
            Phase 2 Shell
          </Badge>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {PLANNED_MODULES.map((module) => {
            const Icon = module.icon
            return (
              <div
                key={module.id}
                className="flex items-start gap-3.5 rounded-xl border border-edge-subtle bg-elevated/45 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge-subtle bg-card text-secondary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-content-primary">
                      {module.name}
                    </h3>
                    <Badge variant="neutral">{module.stage}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-content-secondary">
                    {module.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Design System Component Preview"
        description="Interactive verification of Phase 2 form controls, modal focus behavior, and loading states."
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowLoadingPreview((prev) => !prev)}
            >
              {showLoadingPreview ? 'Show Form Controls' : 'Preview Loading State'}
            </Button>
            <Button
              variant="primary"
              leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setIsPreviewModalOpen(false)}
            >
              Done
            </Button>
          </>
        }
      >
        {showLoadingPreview ? (
          <div className="space-y-4">
            <LoadingState
              compact
              label="Loading state primitive"
              description="Used for future asynchronous surfaces without blocking layout structure."
            />
            <div className="space-y-2 rounded-xl border border-edge-subtle bg-elevated/40 p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Input Primitive"
                placeholder="Example text field"
                hint="Supports hints, icons, and validation states."
              />
              <Select
                label="Select Primitive"
                defaultValue="option-a"
                hint="Styled consistently across dark and light themes."
                options={[
                  { value: 'option-a', label: 'Standard Surface' },
                  { value: 'option-b', label: 'Elevated Surface' },
                ]}
              />
            </div>
            <Textarea
              label="Textarea Primitive"
              rows={3}
              placeholder="Reusable multi-line text input..."
              hint="Non-persistent UI foundation demonstration only."
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
