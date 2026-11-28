import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  AiGenerationRequest,
  AiRoutingSettings,
  ProviderId,
  ProviderUpsertPayload,
} from '../src/types/ai.ts'
import { ServerConfigStore } from './configStore.ts'
import { redactSecrets } from './envLoader.ts'
import { ProviderRequestError } from './providers/types.ts'
import {
  generateWithRouting,
  refreshProviderModels,
  testProviderConnection,
} from './routingEngine.ts'

const MAX_BODY_BYTES = 64 * 1024

let sharedStore: ServerConfigStore | null = null

export function getSharedConfigStore(): ServerConfigStore {
  if (!sharedStore) {
    sharedStore = new ServerConfigStore(process.cwd())
  }
  return sharedStore
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body)
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

function isAllowedHostOrOrigin(req: IncomingMessage): boolean {
  const expectedToken = process.env.ASTROCUT_API_TOKEN?.trim()
  if (expectedToken) {
    const authHeader = req.headers.authorization
    const tokenHeader = req.headers['x-astrocut-token']
    const provided =
      (typeof tokenHeader === 'string' && tokenHeader) ||
      (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : '')
    if (provided !== expectedToken) return false
  }

  const origin = req.headers.origin
  if (origin) {
    try {
      const parsed = new URL(origin)
      const isLoopback =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '[::1]'
      if (!isLoopback) return false
    } catch {
      return false
    }
  }

  return true
}

function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let total = 0
    const chunks: Buffer[] = []

    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request payload exceeds maximum allowed size.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (!text) {
        resolve({} as T)
        return
      }
      try {
        resolve(JSON.parse(text) as T)
      } catch {
        reject(new Error('Invalid JSON request body.'))
      }
    })

    req.on('error', reject)
  })
}

/**
 * Handles all /api/ai/* server-side endpoints securely without exposing API keys to the browser.
 */
export async function handleAiApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  store: ServerConfigStore = getSharedConfigStore(),
): Promise<boolean> {
  const rawUrl = req.url || '/'
  const pathname = rawUrl.split('?')[0]

  if (!pathname.startsWith('/api/ai')) {
    return false
  }

  if (!isAllowedHostOrOrigin(req)) {
    sendJson(res, 403, { error: 'Unauthorized origin or missing API token.' })
    return true
  }

  try {
    // GET /api/ai/system
    if (pathname === '/api/ai/system' && req.method === 'GET') {
      sendJson(res, 200, store.getSnapshot())
      return true
    }

    // PUT /api/ai/providers
    if (pathname === '/api/ai/providers' && req.method === 'PUT') {
      const payload = await readJsonBody<ProviderUpsertPayload>(req)
      const updated = store.upsertProvider(payload)
      sendJson(res, 200, {
        provider: updated,
        snapshot: store.getSnapshot(),
      })
      return true
    }

    // PUT /api/ai/routing
    if (pathname === '/api/ai/routing' && req.method === 'PUT') {
      const payload = await readJsonBody<Partial<AiRoutingSettings>>(req)
      const routing = store.updateRouting(payload)
      sendJson(res, 200, {
        routing,
        snapshot: store.getSnapshot(),
      })
      return true
    }

    // POST /api/ai/generate
    if (pathname === '/api/ai/generate' && req.method === 'POST') {
      const payload = await readJsonBody<AiGenerationRequest>(req)
      if (!payload.videoTitle || !Array.isArray(payload.platforms) || payload.platforms.length === 0) {
        sendJson(res, 400, {
          error: 'videoTitle and at least one target platform are required.',
        })
        return true
      }
      const result = await generateWithRouting(store, payload)
      sendJson(res, 200, result)
      return true
    }

    // POST /api/ai/providers/:id/test
    const testMatch = pathname.match(/^\/api\/ai\/providers\/([^/]+)\/test$/)
    if (testMatch && req.method === 'POST') {
      const providerId = decodeURIComponent(testMatch[1]) as ProviderId
      const result = await testProviderConnection(store, providerId)
      sendJson(res, 200, {
        result,
        snapshot: store.getSnapshot(),
      })
      return true
    }

    // POST /api/ai/providers/:id/models
    const modelsMatch = pathname.match(/^\/api\/ai\/providers\/([^/]+)\/models$/)
    if (modelsMatch && req.method === 'POST') {
      const providerId = decodeURIComponent(modelsMatch[1]) as ProviderId
      const models = await refreshProviderModels(store, providerId)
      sendJson(res, 200, {
        models,
        snapshot: store.getSnapshot(),
      })
      return true
    }

    // DELETE /api/ai/providers/:id
    const deleteMatch = pathname.match(/^\/api\/ai\/providers\/([^/]+)$/)
    if (deleteMatch && req.method === 'DELETE') {
      const providerId = decodeURIComponent(deleteMatch[1]) as ProviderId
      store.deleteProvider(providerId)
      sendJson(res, 200, { snapshot: store.getSnapshot() })
      return true
    }

    sendJson(res, 404, { error: `Unknown AI endpoint: ${pathname}` })
    return true
  } catch (err) {
    const status =
      err instanceof ProviderRequestError && err.status
        ? err.status
        : err instanceof ProviderRequestError && err.code === 'not_configured'
          ? 400
          : 500
    const rawMsg =
      err instanceof Error ? err.message : 'Unexpected server error.'
    const safeMsg = redactSecrets(rawMsg, store.getAllSecrets())
    sendJson(res, status, { error: safeMsg })
    return true
  }
}
