import { AlertTriangle } from 'lucide-react'
import { useAiProviders } from '../../context/AiProvidersContext'
import type { AiTaskType, ProviderId } from '../../types/ai'
import { Badge, Card, Input, Select } from '../ui'

const TASK_DEFINITIONS: Array<{
  id: AiTaskType
  label: string
  description: string
  requiresVideoUnderstanding?: boolean
}> = [
  {
    id: 'titles_descriptions',
    label: 'Titles & Descriptions',
    description: 'YouTube titles, long descriptions, and SEO keywords.',
  },
  {
    id: 'captions_hashtags',
    label: 'Captions & Hashtags',
    description: 'Instagram and TikTok captions plus hashtag sets.',
  },
  {
    id: 'translation_roman_urdu',
    label: 'Translation & Roman Urdu / Hinglish',
    description: 'Latin-script Roman Urdu and Hinglish copy adaptation.',
  },
  {
    id: 'transcript_cleanup',
    label: 'Transcript Cleanup',
    description: 'Prepared route for cleaning speech transcripts in Phase 7.',
  },
  {
    id: 'video_summaries',
    label: 'Video Summaries',
    description: 'Requires video/audio understanding (planned for Phase 7).',
    requiresVideoUnderstanding: true,
  },
]

/**
 * Configures optional per-task provider and model overrides.
 */
export function TaskRoutingCard() {
  const { providers, routing, updateRouting } = useAiProviders()
  if (!routing) return null

  const updateRoute = (
    taskId: AiTaskType,
    providerId: ProviderId | 'default',
    model: string,
  ) => {
    void updateRouting({
      taskRoutes: {
        ...routing.taskRoutes,
        [taskId]: { providerId, model },
      },
    })
  }

  return (
    <Card
      title="Task-Specific Model Routing"
      subtitle="Optionally assign dedicated providers and models for specific content tasks."
    >
      <div className="space-y-3">
        {TASK_DEFINITIONS.map((task) => {
          const route = routing.taskRoutes[task.id] ?? {
            providerId: 'default',
            model: '',
          }
          const chosenProvider =
            route.providerId !== 'default'
              ? providers.find((p) => p.id === route.providerId)
              : undefined

          return (
            <div
              key={task.id}
              className="grid grid-cols-1 gap-3 rounded-xl border border-edge-subtle bg-elevated p-4 lg:grid-cols-12 lg:items-center"
            >
              <div className="space-y-1 lg:col-span-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-content-primary">
                    {task.label}
                  </p>
                  {task.requiresVideoUnderstanding && (
                    <Badge
                      variant="warning"
                      icon={<AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                    >
                      Requires Video Input (Phase 7)
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-content-secondary">
                  {task.description}
                </p>
              </div>

              <div className="lg:col-span-4">
                <Select
                  aria-label={`${task.label} provider`}
                  value={route.providerId}
                  onChange={(e) => {
                    const pid = e.target.value as ProviderId | 'default'
                    const p = providers.find((item) => item.id === pid)
                    updateRoute(
                      task.id,
                      pid,
                      pid === 'default'
                        ? ''
                        : p?.defaultModel || p?.discoveredModels[0]?.name || '',
                    )
                  }}
                  options={[
                    { value: 'default', label: 'Use Default / Automatic' },
                    ...providers
                      .filter((p) => p.enabled)
                      .map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </div>

              <div className="lg:col-span-3">
                <Input
                  aria-label={`${task.label} model`}
                  value={route.model}
                  disabled={route.providerId === 'default'}
                  placeholder={
                    route.providerId === 'default'
                      ? 'Inherited'
                      : chosenProvider?.defaultModel || 'Model name'
                  }
                  onChange={(e) =>
                    updateRoute(task.id, route.providerId, e.target.value)
                  }
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
