import type {
  BuiltInProviderId,
  ProviderApiFormat,
  ProviderCapabilities,
  ProviderId,
} from '../src/types/ai.ts'
import { anthropicAdapter } from './providers/anthropicAdapter.ts'
import { geminiAdapter } from './providers/geminiAdapter.ts'
import {
  DEFAULT_OLLAMA_BASE_URL,
  ollamaAdapter,
} from './providers/ollamaAdapter.ts'
import { openAiCompatibleAdapter } from './providers/openAiCompatibleAdapter.ts'
import type { ServerAiAdapter } from './providers/types.ts'

export interface BuiltInProviderDefinition {
  id: BuiltInProviderId
  name: string
  description: string
  apiFormat: ProviderApiFormat
  defaultBaseUrl: string
  defaultModel: string
  envVarName?: string
  capabilities: ProviderCapabilities
  extraHeaders?: Record<string, string>
}

export const BUILT_IN_PROVIDERS: BuiltInProviderDefinition[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Official Google Gemini API (generateContent & model discovery).',
    apiFormat: 'gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    envVarName: 'GEMINI_API_KEY',
    capabilities: {
      kind: 'cloud',
      supportsModelDiscovery: true,
      supportsStructuredJson: true,
      supportsStreaming: true,
      supportsUsageMetrics: true,
      supportsVideoInput: false,
      requiresApiKey: true,
    },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Official OpenAI Chat Completions & Models API.',
    apiFormat: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    envVarName: 'OPENAI_API_KEY',
    capabilities: {
      kind: 'cloud',
      supportsModelDiscovery: true,
      supportsStructuredJson: true,
      supportsStreaming: true,
      supportsUsageMetrics: true,
      supportsVideoInput: false,
      requiresApiKey: true,
    },
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Official Anthropic Messages API with x-api-key authentication.',
    apiFormat: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-latest',
    envVarName: 'ANTHROPIC_API_KEY',
    capabilities: {
      kind: 'cloud',
      supportsModelDiscovery: true,
      supportsStructuredJson: false,
      supportsStreaming: true,
      supportsUsageMetrics: true,
      supportsVideoInput: false,
      requiresApiKey: true,
    },
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Official Groq OpenAI-compatible low-latency inference API.',
    apiFormat: 'openai-compatible',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    envVarName: 'GROQ_API_KEY',
    capabilities: {
      kind: 'cloud',
      supportsModelDiscovery: true,
      supportsStructuredJson: true,
      supportsStreaming: true,
      supportsUsageMetrics: true,
      supportsVideoInput: false,
      requiresApiKey: true,
    },
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified OpenRouter gateway supporting multi-vendor models.',
    apiFormat: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    envVarName: 'OPENROUTER_API_KEY',
    capabilities: {
      kind: 'cloud',
      supportsModelDiscovery: true,
      supportsStructuredJson: true,
      supportsStreaming: true,
      supportsUsageMetrics: true,
      supportsVideoInput: false,
      requiresApiKey: true,
    },
    extraHeaders: {
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'AstroCut',
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Official DeepSeek Chat Completions API.',
    apiFormat: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    envVarName: 'DEEPSEEK_API_KEY',
    capabilities: {
      kind: 'cloud',
      supportsModelDiscovery: true,
      supportsStructuredJson: true,
      supportsStreaming: true,
      supportsUsageMetrics: true,
      supportsVideoInput: false,
      requiresApiKey: true,
    },
  },
  {
    id: 'mistral',
    name: 'Mistral',
    description: 'Official Mistral AI Chat Completions & Models API.',
    apiFormat: 'openai-compatible',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    envVarName: 'MISTRAL_API_KEY',
    capabilities: {
      kind: 'cloud',
      supportsModelDiscovery: true,
      supportsStructuredJson: true,
      supportsStreaming: true,
      supportsUsageMetrics: true,
      supportsVideoInput: false,
      requiresApiKey: true,
    },
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Zero-API-cost local inference running on your own PC.',
    apiFormat: 'ollama',
    defaultBaseUrl: DEFAULT_OLLAMA_BASE_URL,
    defaultModel: '',
    envVarName: 'OLLAMA_BASE_URL',
    capabilities: {
      kind: 'local',
      supportsModelDiscovery: true,
      supportsStructuredJson: true,
      supportsStreaming: true,
      supportsUsageMetrics: true,
      supportsVideoInput: false,
      requiresApiKey: false,
    },
  },
]

export function getBuiltInDefinition(
  id: ProviderId,
): BuiltInProviderDefinition | undefined {
  return BUILT_IN_PROVIDERS.find((p) => p.id === id)
}

export function getAdapterForFormat(format: ProviderApiFormat): ServerAiAdapter {
  switch (format) {
    case 'gemini':
      return geminiAdapter
    case 'anthropic':
      return anthropicAdapter
    case 'ollama':
      return ollamaAdapter
    case 'openai-compatible':
    default:
      return openAiCompatibleAdapter
  }
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function isLocalhostUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    )
  } catch {
    return false
  }
}
