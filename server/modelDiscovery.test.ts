import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import type { ProviderPublicConfig } from '../src/types/ai.ts'
import { buildModelSelectState } from '../src/utils/modelOptions.ts'
import { ServerConfigStore } from './configStore.ts'
import { anthropicAdapter } from './providers/anthropicAdapter.ts'
import { geminiAdapter } from './providers/geminiAdapter.ts'
import { ollamaAdapter } from './providers/ollamaAdapter.ts'
import { openAiCompatibleAdapter } from './providers/openAiCompatibleAdapter.ts'
import type { ServerProviderRuntimeConfig } from './providers/types.ts'
import {
  refreshProviderModels,
  testProviderConnection,
} from './routingEngine.ts'

async function withMockHttp(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const address = server.address() as { port: number }
  const url = `http://127.0.0.1:${address.port}`
  try {
    await fn(url)
  } finally {
    server.close()
  }
}

function makeRuntime(
  overrides: Partial<ServerProviderRuntimeConfig>,
): ServerProviderRuntimeConfig {
  return {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'http://127.0.0.1:1',
    defaultModel: '',
    apiKey: 'sk-test-1234',
    capabilities: {
      kind: 'cloud',
      supportsModelDiscovery: true,
      supportsStructuredJson: true,
      supportsStreaming: false,
      supportsUsageMetrics: true,
      supportsVideoInput: false,
      requiresApiKey: true,
    },
    ...overrides,
  }
}

describe('Universal AI Provider Model Discovery', () => {
  it('Gemini adapter paginates via nextPageToken, filters non-generateContent/embedding/image models, and verifies text capability', async () => {
    const requestedUrls: string[] = []
    await withMockHttp(
      (req, res) => {
        requestedUrls.push(req.url ?? '')
        res.setHeader('Content-Type', 'application/json')
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (url.pathname !== '/models') {
          res.statusCode = 404
          res.end()
          return
        }
        const pageToken = url.searchParams.get('pageToken')
        if (!pageToken) {
          res.end(
            JSON.stringify({
              models: [
                {
                  name: 'models/gemini-2.5-flash',
                  displayName: 'Gemini 2.5 Flash',
                  inputTokenLimit: 1048576,
                  supportedGenerationMethods: ['generateContent', 'countTokens'],
                },
                {
                  name: 'models/gemini-2.5-pro',
                  supportedGenerationMethods: ['generateContent'],
                },
                {
                  name: 'models/text-embedding-004',
                  supportedGenerationMethods: ['embedContent'],
                },
                {
                  name: 'models/imagen-3.0-generate-002',
                  supportedGenerationMethods: ['generateContent'],
                },
              ],
              nextPageToken: 'page-2-tok',
            }),
          )
          return
        }
        if (pageToken === 'page-2-tok') {
          res.end(
            JSON.stringify({
              models: [
                {
                  name: 'models/gemini-2.0-flash',
                  supportedGenerationMethods: ['generateContent'],
                },
                {
                  // Duplicate should be deduplicated cleanly
                  name: 'models/gemini-2.5-pro',
                  supportedGenerationMethods: ['generateContent'],
                },
                {
                  name: 'models/aqa',
                  supportedGenerationMethods: ['generateAnswer'],
                },
              ],
            }),
          )
          return
        }
        res.statusCode = 400
        res.end(JSON.stringify({ error: { message: 'Unexpected token' } }))
      },
      async (baseUrl) => {
        const models = await geminiAdapter.listModels(
          makeRuntime({
            id: 'gemini',
            baseUrl,
            apiKey: 'AIzaTestKey1234',
          }),
        )
        assert.equal(requestedUrls.length, 2)
        assert.deepEqual(
          models.map((m) => m.name),
          ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
        )
        assert.equal(
          models.every((m) => m.verificationStatus === 'verified_text'),
          true,
        )
      },
    )
  })

  it('Anthropic adapter paginates cursor pages (after_id / has_more) and skips malformed items', async () => {
    const requestedUrls: string[] = []
    await withMockHttp(
      (req, res) => {
        requestedUrls.push(req.url ?? '')
        res.setHeader('Content-Type', 'application/json')
        assert.equal(req.headers['x-api-key'], 'sk-ant-test')
        assert.ok(req.headers['anthropic-version'])

        const url = new URL(req.url ?? '/', 'http://localhost')
        if (url.pathname !== '/v1/models') {
          res.statusCode = 404
          res.end()
          return
        }
        const afterId = url.searchParams.get('after_id')
        if (!afterId) {
          res.end(
            JSON.stringify({
              data: [
                { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4' },
                { id: 'claude-3-5-haiku-latest', display_name: 'Claude 3.5 Haiku' },
                { id: '' },
              ],
              has_more: true,
              last_id: 'claude-3-5-haiku-latest',
            }),
          )
          return
        }
        assert.equal(afterId, 'claude-3-5-haiku-latest')
        res.end(
          JSON.stringify({
            data: [
              { id: 'claude-3-7-sonnet-latest', display_name: 'Claude 3.7 Sonnet' },
              { id: 'claude-3-opus-20240229', display_name: 'Claude 3 Opus' },
            ],
            has_more: false,
          }),
        )
      },
      async (baseUrl) => {
        const models = await anthropicAdapter.listModels(
          makeRuntime({
            id: 'anthropic',
            baseUrl: `${baseUrl}/v1`,
            apiKey: 'sk-ant-test',
          }),
        )
        assert.equal(requestedUrls.length, 2)
        assert.deepEqual(
          models.map((m) => m.name),
          [
            'claude-sonnet-4-20250514',
            'claude-3-5-haiku-latest',
            'claude-3-7-sonnet-latest',
            'claude-3-opus-20240229',
          ],
        )
        assert.equal(
          models.every((m) => m.verificationStatus === 'listed'),
          true,
        )
      },
    )
  })

  it('OpenAI-compatible adapter uses clean /models request without forced query params, follows cursor/next when supported, preserves IDs, and filters non-text models', async () => {
    const firstPageUrls: string[] = []
    await withMockHttp(
      (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        const url = new URL(req.url ?? '/', 'http://localhost')

        // OpenAI / Groq / DeepSeek / Mistral standard single-page GET /models
        if (url.pathname === '/openai/v1/models') {
          firstPageUrls.push(req.url ?? '')
          assert.equal(url.search, '')
          res.end(
            JSON.stringify({
              data: [
                { id: 'gpt-4o' },
                { id: 'gpt-4o-mini' },
                { id: 'o3-mini' },
                { id: 'text-embedding-3-small' },
                { id: 'whisper-1' },
                { id: 'tts-1' },
                { id: 'dall-e-3' },
                { id: 'omni-moderation-latest' },
                { id: 'gpt-4o' },
              ],
            }),
          )
          return
        }

        // OpenRouter rich model list with architecture modalities
        if (url.pathname === '/openrouter/api/v1/models') {
          assert.equal(url.search, '')
          res.end(
            JSON.stringify({
              data: [
                {
                  id: 'anthropic/claude-3.5-sonnet',
                  context_length: 200000,
                  architecture: {
                    modality: 'text+image->text',
                    output_modalities: ['text'],
                  },
                },
                {
                  id: 'deepseek/deepseek-chat-v3',
                  architecture: {
                    modality: 'text->text',
                    output_modalities: ['text'],
                  },
                },
                {
                  id: 'black-forest-labs/flux-1.1-pro',
                  architecture: {
                    modality: 'text->image',
                    output_modalities: ['image'],
                  },
                },
              ],
            }),
          )
          return
        }

        // Paginated custom endpoint using has_more + last_id
        if (url.pathname === '/custom-paged/models') {
          const after = url.searchParams.get('after')
          if (!after) {
            assert.equal(url.search, '')
            res.end(
              JSON.stringify({
                models: [{ id: 'custom/model-a' }, { id: 'custom/model-b' }],
                has_more: true,
                last_id: 'custom/model-b',
              }),
            )
            return
          }
          assert.equal(after, 'custom/model-b')
          res.end(
            JSON.stringify({
              models: [{ id: 'custom/model-c' }],
              has_more: false,
            }),
          )
          return
        }

        // Custom endpoint where /models is unsupported
        if (url.pathname === '/custom-no-models/models') {
          res.statusCode = 404
          res.end(JSON.stringify({ error: { message: 'Not Found' } }))
          return
        }

        res.statusCode = 404
        res.end()
      },
      async (baseUrl) => {
        const openaiModels = await openAiCompatibleAdapter.listModels(
          makeRuntime({
            id: 'openai',
            baseUrl: `${baseUrl}/openai/v1`,
          }),
        )
        assert.deepEqual(firstPageUrls, ['/openai/v1/models'])
        assert.deepEqual(
          openaiModels.map((m) => m.name),
          ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
        )
        assert.equal(openaiModels[0]?.verificationStatus, 'listed')

        const openrouterModels = await openAiCompatibleAdapter.listModels(
          makeRuntime({
            id: 'openrouter',
            baseUrl: `${baseUrl}/openrouter/api/v1`,
          }),
        )
        assert.deepEqual(
          openrouterModels.map((m) => m.name),
          ['anthropic/claude-3.5-sonnet', 'deepseek/deepseek-chat-v3'],
        )
        assert.equal(openrouterModels[0]?.verificationStatus, 'verified_text')
        assert.equal(openrouterModels[0]?.contextWindow, 200000)

        const pagedCustom = await openAiCompatibleAdapter.listModels(
          makeRuntime({
            id: 'custom-paged' as ServerProviderRuntimeConfig['id'],
            baseUrl: `${baseUrl}/custom-paged`,
          }),
        )
        assert.deepEqual(
          pagedCustom.map((m) => m.name),
          ['custom/model-a', 'custom/model-b', 'custom/model-c'],
        )

        await assert.rejects(
          () =>
            openAiCompatibleAdapter.listModels(
              makeRuntime({
                id: 'custom-none' as ServerProviderRuntimeConfig['id'],
                baseUrl: `${baseUrl}/custom-no-models`,
              }),
            ),
          /does not support model discovery at GET \/models/i,
        )
      },
    )
  })

  it('Ollama adapter reads all /api/tags models without pagination and excludes embedding models', async () => {
    let seenUrl = ''
    await withMockHttp(
      (req, res) => {
        seenUrl = req.url ?? ''
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            models: [
              { name: 'llama3.2:3b', size: 2_000_000_000 },
              { name: 'qwen2.5:7b', size: 4_500_000_000 },
              { name: 'deepseek-r1:8b', size: 4_900_000_000 },
              { name: 'nomic-embed-text:latest', size: 274_000_000 },
            ],
          }),
        )
      },
      async (baseUrl) => {
        const models = await ollamaAdapter.listModels(
          makeRuntime({
            id: 'ollama',
            baseUrl,
            apiKey: undefined,
            capabilities: {
              kind: 'local',
              supportsModelDiscovery: true,
              supportsStructuredJson: true,
              supportsStreaming: false,
              supportsUsageMetrics: true,
              supportsVideoInput: false,
              requiresApiKey: false,
            },
          }),
        )
        assert.equal(seenUrl, '/api/tags')
        assert.deepEqual(
          models.map((m) => m.name),
          ['llama3.2:3b', 'qwen2.5:7b', 'deepseek-r1:8b'],
        )
      },
    )
  })

  it('ServerConfigStore and routingEngine preserve all discovered models across defaultModel edits and restarts, and surface discovery failures honestly', async () => {
    let shouldFailRefresh = false
    await withMockHttp(
      (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (shouldFailRefresh) {
          res.statusCode = 401
          res.end(JSON.stringify({ error: { message: 'Invalid API key' } }))
          return
        }
        if (req.url === '/v1/models') {
          res.end(
            JSON.stringify({
              data: [
                { id: 'llama-3.3-70b-versatile' },
                { id: 'llama-3.1-8b-instant' },
                { id: 'mixtral-8x7b-32768' },
                { id: 'gemma2-9b-it' },
                { id: 'whisper-large-v3' },
              ],
            }),
          )
          return
        }
        res.statusCode = 404
        res.end()
      },
      async (baseUrl) => {
        const dir = mkdtempSync(tmpdir() + '/astrocut-discovery-persist-')
        try {
          const store = new ServerConfigStore(dir)
          store.upsertProvider({
            id: 'groq',
            baseUrl: `${baseUrl}/v1`,
            apiKey: 'gsk_test_secret_12345',
            defaultModel: 'llama-3.3-70b-versatile',
          })

          const check = await testProviderConnection(store, 'groq')
          assert.equal(check.connected, true)
          assert.equal(check.models.length, 4)

          // Changing active defaultModel or re-saving unchanged URL must NOT wipe discoveredModels
          store.upsertProvider({
            id: 'groq',
            baseUrl: `${baseUrl}/v1`,
            defaultModel: 'mixtral-8x7b-32768',
          })
          const afterSave = store.getPublicProvider('groq')!
          assert.equal(afterSave.defaultModel, 'mixtral-8x7b-32768')
          assert.equal(afterSave.discoveredModels.length, 4)
          assert.equal(afterSave.discoveryFailed, false)

          // Simulate server restart by reloading config store from disk
          const reloadedStore = new ServerConfigStore(dir)
          const reloadedPub = reloadedStore.getPublicProvider('groq')!
          assert.equal(reloadedPub.discoveredModels.length, 4)
          assert.deepEqual(
            reloadedPub.discoveredModels.map((m) => m.name),
            [
              'llama-3.3-70b-versatile',
              'llama-3.1-8b-instant',
              'mixtral-8x7b-32768',
              'gemma2-9b-it',
            ],
          )

          // Verify zero secrets leaked in persisted file's discoveredModels
          const rawSaved = readFileSync(
            resolve(dir, '.astrocut', 'providers.local.json'),
            'utf8',
          )
          const parsedSaved = JSON.parse(rawSaved) as {
            providers: Record<string, { discoveredModels?: unknown[] }>
          }
          assert.equal(
            JSON.stringify(parsedSaved.providers.groq.discoveredModels).includes(
              'gsk_test_secret',
            ),
            false,
          )

          // Failed refresh sets discoveryFailed: true and clears discoveredModels instead of pretending 1 default model succeeded
          shouldFailRefresh = true
          await assert.rejects(
            () => refreshProviderModels(reloadedStore, 'groq'),
            /rejected/i,
          )
          const failedPub = reloadedStore.getPublicProvider('groq')!
          assert.equal(failedPub.status, 'error')
          assert.equal(failedPub.discoveryFailed, true)
          assert.equal(failedPub.discoveredModels.length, 0)
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
  })

  it('UI model option builder lists all discovered models, indicates capability status, and never hides discovery failure behind defaultModel', () => {
    const baseProvider: ProviderPublicConfig = {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Gemini API',
      apiFormat: 'gemini',
      isCustom: false,
      enabled: true,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      defaultModel: 'gemini-2.5-flash',
      hasApiKey: true,
      maskedApiKey: 'AIza••••1234',
      keySource: 'config',
      capabilities: {
        kind: 'cloud',
        supportsModelDiscovery: true,
        supportsStreaming: false,
        supportsStructuredJson: true,
        supportsUsageMetrics: true,
        supportsVideoInput: true,
        requiresApiKey: true,
      },
      status: 'connected',
      statusMessage: 'Connected',
      discoveredModels: [
        { name: 'gemini-2.5-flash', verificationStatus: 'verified_text' },
        { name: 'gemini-2.5-pro', verificationStatus: 'verified_text' },
        { name: 'gemini-2.0-flash', verificationStatus: 'verified_text' },
        { name: 'gemini-1.5-pro', verificationStatus: 'listed' },
      ],
      discoveryFailed: false,
      implementationStatus: 'implemented',
    }

    const multiState = buildModelSelectState(baseProvider)
    assert.equal(multiState.discoveredCount, 4)
    assert.equal(multiState.verifiedCount, 3)
    assert.equal(multiState.hasSelectableModels, true)
    assert.equal(multiState.options.length, 4)
    assert.match(multiState.options[0].label, /verified text/i)
    assert.match(multiState.options[3].label, /listed/i)

    const failedState = buildModelSelectState({
      ...baseProvider,
      status: 'error',
      discoveredModels: [],
      discoveryFailed: true,
      defaultModel: 'gemini-2.5-flash',
    })
    assert.equal(failedState.discoveredCount, 0)
    assert.equal(failedState.discoveryFailed, true)
    assert.equal(failedState.hasSelectableModels, false)
    assert.equal(failedState.options[0].disabled, true)
    assert.match(failedState.options[0].label, /discovery failed/i)
  })
})
