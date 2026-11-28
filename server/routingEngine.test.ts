import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { describe, it } from 'node:test'
import type { AiGenerationRequest } from '../src/types/ai.ts'
import { ServerConfigStore } from './configStore.ts'
import { maskApiKey, redactSecrets } from './envLoader.ts'
import {
  generateWithRouting,
  testProviderConnection,
} from './routingEngine.ts'

function createSampleRequest(
  overrides: Partial<AiGenerationRequest> = {},
): AiGenerationRequest {
  return {
    videoId: 'vid-1',
    videoTitle: 'Night Street Color Grading Tutorial',
    fileExtension: 'mp4',
    durationSeconds: 185,
    sizeBytes: 12_500_000,
    videoContext: 'Explains noise reduction and color balance for night clips.',
    settings: {
      language: 'english',
      platformSelection: 'multiple',
      tone: 'educational',
    },
    platforms: ['youtube', 'instagram', 'tiktok'],
    ...overrides,
  }
}

async function withMockServers(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const url = `http://127.0.0.1:${address.port}`
  try {
    await fn(url)
  } finally {
    server.close()
  }
}

describe('AstroCut Universal Multi-Provider AI Architecture', () => {
  it('masks and redacts API keys cleanly without exposing raw secrets', () => {
    const secret = 'AIzaSyDemoSecretKey1234567890'
    const masked = maskApiKey(secret)
    assert.equal(masked, 'AIza••••7890')
    assert.equal(maskApiKey('short'), '••••••••')

    const clean = redactSecrets(`Failed with key ${secret}`, [secret])
    assert.equal(clean.includes(secret), false)
    assert.equal(clean.includes('[REDACTED]'), true)

    const dir = mkdtempSync(tmpdir() + '/astrocut-test-')
    try {
      const store = new ServerConfigStore(dir)
      const pub = store.upsertProvider({
        id: 'gemini',
        apiKey: secret,
        defaultModel: 'gemini-2.5-flash',
      })
      assert.equal(pub.hasApiKey, true)
      assert.equal(pub.maskedApiKey, 'AIza••••7890')
      assert.equal(JSON.stringify(store.getSnapshot()).includes(secret), false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('connects to Google Gemini official format, discovers models, and generates structured JSON', async () => {
    await withMockServers(
      (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.url === '/models' && req.method === 'GET') {
          if (req.headers['x-goog-api-key'] !== 'valid-gemini-key') {
            res.statusCode = 401
            res.end(JSON.stringify({ error: { message: 'API key invalid' } }))
            return
          }
          res.end(
            JSON.stringify({
              models: [
                {
                  name: 'models/gemini-2.5-flash',
                  displayName: 'Gemini 2.5 Flash',
                  supportedGenerationMethods: ['generateContent'],
                },
              ],
            }),
          )
          return
        }
        if (
          req.url === '/models/gemini-2.5-flash:generateContent' &&
          req.method === 'POST'
        ) {
          res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          youtube: {
                            title: 'Clean Night Color Grading Guide',
                            description: 'Tutorial on low-light grading.',
                            keywords: 'color grading, night video',
                            hashtags: '#ColorGrading #AstroCut',
                          },
                          instagram: {
                            caption: 'Night footage grading tips.',
                            hashtags: '#Reels #VideoEditing',
                          },
                          tiktok: {
                            caption: 'Quick night grading fix.',
                            hashtags: '#EditingTips',
                          },
                        }),
                      },
                    ],
                  },
                },
              ],
              usageMetadata: {
                promptTokenCount: 120,
                candidatesTokenCount: 80,
                totalTokenCount: 200,
              },
            }),
          )
          return
        }
        res.statusCode = 404
        res.end()
      },
      async (baseUrl) => {
        const dir = mkdtempSync(tmpdir() + '/astrocut-gemini-')
        try {
          const store = new ServerConfigStore(dir)
          store.upsertProvider({
            id: 'gemini',
            baseUrl,
            apiKey: 'bad-key',
            defaultModel: 'gemini-2.5-flash',
          })

          const badCheck = await testProviderConnection(store, 'gemini')
          assert.equal(badCheck.connected, false)
          assert.equal(badCheck.errorCode, 'unauthorized')

          store.upsertProvider({ id: 'gemini', apiKey: 'valid-gemini-key' })
          const okCheck = await testProviderConnection(store, 'gemini')
          assert.equal(okCheck.connected, true)
          assert.equal(okCheck.models[0]?.name, 'gemini-2.5-flash')

          store.updateRouting({ mode: 'manual', defaultProviderId: 'gemini' })
          const result = await generateWithRouting(store, createSampleRequest())
          assert.equal(result.providerId, 'gemini')
          assert.equal(result.modeUsed, 'manual')
          assert.equal(result.fallbackUsed, false)
          assert.equal(
            result.content.youtube?.title,
            'Clean Night Color Grading Guide',
          )
          assert.equal(result.usage?.totalTokens, 200)
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
  })

  it('never silently switches providers in Manual mode on failure, and falls back in Automatic mode when enabled', async () => {
    await withMockServers(
      (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        // Route /openai/* -> rate limit 429; /ollama/* -> valid response
        if (req.url?.startsWith('/openai')) {
          res.statusCode = 429
          res.end(JSON.stringify({ error: { message: 'Rate limit exceeded' } }))
          return
        }
        if (req.url === '/ollama/api/tags') {
          res.end(JSON.stringify({ models: [{ name: 'llama3.2:3b' }] }))
          return
        }
        if (req.url === '/ollama/api/chat') {
          res.end(
            JSON.stringify({
              model: 'llama3.2:3b',
              message: {
                content: JSON.stringify({
                  youtube: {
                    title: 'Fallback Ollama Title',
                    description: 'Generated by local Ollama fallback.',
                    keywords: 'ollama, local',
                    hashtags: '#Ollama',
                  },
                }),
              },
            }),
          )
          return
        }
        res.statusCode = 404
        res.end()
      },
      async (baseUrl) => {
        const dir = mkdtempSync(tmpdir() + '/astrocut-routing-')
        try {
          const store = new ServerConfigStore(dir)
          store.upsertProvider({
            id: 'openai',
            baseUrl: `${baseUrl}/openai`,
            apiKey: 'sk-test-123456',
            defaultModel: 'gpt-4o-mini',
            enabled: true,
          })
          store.upsertProvider({
            id: 'ollama',
            baseUrl: `${baseUrl}/ollama`,
            defaultModel: 'llama3.2:3b',
            enabled: true,
          })

          // Manual mode: fails directly on OpenAI 429 without switching to Ollama
          store.updateRouting({
            mode: 'manual',
            defaultProviderId: 'openai',
            defaultModel: 'gpt-4o-mini',
            fallbackEnabled: true,
          })
          await assert.rejects(
            () =>
              generateWithRouting(
                store,
                createSampleRequest({ platforms: ['youtube'] }),
              ),
            /rate limit/i,
          )

          // Automatic mode with fallback enabled: OpenAI fails -> falls back to Ollama
          store.updateRouting({
            mode: 'automatic',
            defaultProviderId: 'openai',
            defaultModel: 'gpt-4o-mini',
            fallbackEnabled: true,
            providerPriority: ['openai', 'ollama'],
          })
          const autoResult = await generateWithRouting(
            store,
            createSampleRequest({ platforms: ['youtube'] }),
          )
          assert.equal(autoResult.providerId, 'ollama')
          assert.equal(autoResult.fallbackUsed, true)
          assert.equal(autoResult.attempts.length, 2)
          assert.equal(
            autoResult.content.youtube?.title,
            'Fallback Ollama Title',
          )
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
  })

  it('rejects malformed JSON and blocks video_summaries on text-only endpoints', async () => {
    await withMockServers(
      (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.url === '/v1/messages') {
          res.end(
            JSON.stringify({
              model: 'claude-3-5-haiku-latest',
              content: [{ type: 'text', text: 'malformed non-json output' }],
            }),
          )
          return
        }
        res.statusCode = 404
        res.end()
      },
      async (baseUrl) => {
        const dir = mkdtempSync(tmpdir() + '/astrocut-cap-')
        try {
          const store = new ServerConfigStore(dir)
          store.upsertProvider({
            id: 'anthropic',
            baseUrl: `${baseUrl}/v1`,
            apiKey: 'sk-ant-test-9999',
            defaultModel: 'claude-3-5-haiku-latest',
          })
          store.updateRouting({
            mode: 'manual',
            defaultProviderId: 'anthropic',
          })

          await assert.rejects(
            () =>
              generateWithRouting(
                store,
                createSampleRequest({ platforms: ['youtube'] }),
              ),
            /valid JSON/i,
          )

          await assert.rejects(
            () =>
              generateWithRouting(
                store,
                createSampleRequest({
                  taskType: 'video_summaries',
                  platforms: ['youtube'],
                }),
              ),
            /Phase 7/i,
          )
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
  })
})
