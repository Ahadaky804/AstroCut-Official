import type { AiModelInfo, ProviderPublicConfig } from '../types/ai.ts'

export interface ModelSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface ModelSelectState {
  options: ModelSelectOption[]
  selectedValue: string
  hasSelectableModels: boolean
  discoveredCount: number
  verifiedCount: number
  discoveryFailed: boolean
}

function formatModelLabel(model: AiModelInfo): string {
  if (model.verificationStatus === 'verified_text') {
    return `${model.name} (verified text)`
  }
  if (model.verificationStatus === 'listed') {
    return `${model.name} (listed)`
  }
  return model.name
}

export function buildModelSelectState(
  provider: ProviderPublicConfig | undefined,
  preferredSelection?: string,
  options?: { allowAutoDefault?: boolean; autoDefaultLabel?: string },
): ModelSelectState {
  const allowAutoDefault = Boolean(options?.allowAutoDefault)
  const autoDefaultLabel =
    options?.autoDefaultLabel ?? 'Use provider default / first discovered model'

  if (!provider) {
    return {
      options: allowAutoDefault
        ? [{ value: '', label: autoDefaultLabel }]
        : [{ value: '', label: 'Select a provider first', disabled: true }],
      selectedValue: '',
      hasSelectableModels: allowAutoDefault,
      discoveredCount: 0,
      verifiedCount: 0,
      discoveryFailed: false,
    }
  }

  const discoveryFailed = Boolean(provider.discoveryFailed)
  const seen = new Set<string>()
  const uniqueDiscovered: AiModelInfo[] = []
  for (const model of provider.discoveredModels) {
    const name = model.name?.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    uniqueDiscovered.push({ ...model, name })
  }

  const discoveredCount = uniqueDiscovered.length
  const verifiedCount = uniqueDiscovered.filter(
    (m) => m.verificationStatus === 'verified_text',
  ).length

  if (discoveredCount > 0) {
    const selectOptions: ModelSelectOption[] = allowAutoDefault
      ? [{ value: '', label: autoDefaultLabel }]
      : []

    for (const model of uniqueDiscovered) {
      selectOptions.push({
        value: model.name,
        label: formatModelLabel(model),
      })
    }

    const candidate = preferredSelection?.trim() ?? provider.defaultModel.trim()
    if (candidate && !seen.has(candidate)) {
      selectOptions.push({
        value: candidate,
        label: `${candidate} (saved default — not in discovered list)`,
      })
    }

    const selectedValue = allowAutoDefault
      ? candidate
      : candidate || uniqueDiscovered[0].name

    return {
      options: selectOptions,
      selectedValue,
      hasSelectableModels: true,
      discoveredCount,
      verifiedCount,
      discoveryFailed: false,
    }
  }

  if (discoveryFailed) {
    return {
      options: allowAutoDefault
        ? [
            { value: '', label: autoDefaultLabel },
            {
              value: '__discovery_failed__',
              label: 'Model discovery failed — retry Test Connection or Models',
              disabled: true,
            },
          ]
        : [
            {
              value: '',
              label: 'Model discovery failed — retry Test Connection or Models',
              disabled: true,
            },
          ],
      selectedValue: '',
      hasSelectableModels: allowAutoDefault,
      discoveredCount: 0,
      verifiedCount: 0,
      discoveryFailed: true,
    }
  }

  const configuredFallback =
    preferredSelection?.trim() || provider.defaultModel.trim()

  if (allowAutoDefault) {
    const selectOptions: ModelSelectOption[] = [
      { value: '', label: autoDefaultLabel },
    ]
    if (configuredFallback) {
      selectOptions.push({
        value: configuredFallback,
        label: `${configuredFallback} (unverified preset — refresh models)`,
      })
    }
    return {
      options: selectOptions,
      selectedValue: preferredSelection?.trim() ?? '',
      hasSelectableModels: true,
      discoveredCount: 0,
      verifiedCount: 0,
      discoveryFailed: false,
    }
  }

  if (configuredFallback) {
    return {
      options: [
        {
          value: configuredFallback,
          label: `${configuredFallback} (preset — run Test Connection to discover all)`,
        },
      ],
      selectedValue: configuredFallback,
      hasSelectableModels: true,
      discoveredCount: 0,
      verifiedCount: 0,
      discoveryFailed: false,
    }
  }

  return {
    options: [
      {
        value: '',
        label: 'No models loaded (Test Connection or Refresh Models)',
        disabled: true,
      },
    ],
    selectedValue: '',
    hasSelectableModels: false,
    discoveredCount: 0,
    verifiedCount: 0,
    discoveryFailed: false,
  }
}
