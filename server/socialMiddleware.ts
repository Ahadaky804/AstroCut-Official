import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SocialPlatformId } from '../src/types/social.ts'
import { redactSecrets } from './envLoader.ts'
import { resolveSocialEncryptionKey } from './social/cryptoVault.ts'
import {
  SOCIAL_PLATFORM_ORDER,
  SocialIntegrationService,
} from './social/socialService.ts'
import { SocialOAuthError } from './social/types.ts'

const SESSION_COOKIE_NAME = 'astrocut_sid'
const CSRF_HEADER_NAME = 'x-astrocut-csrf'
const VALID_PLATFORMS = new Set<SocialPlatformId>(SOCIAL_PLATFORM_ORDER)

let sharedService: SocialIntegrationService | null = null

export function getSharedSocialService(): SocialIntegrationService {
  if (!sharedService) {
    sharedService = new SocialIntegrationService(process.cwd())
  }
  return sharedService
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie
  if (!header) return {}
  const map: Record<string, string> = {}
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const name = part.slice(0, eq).trim()
    const val = part.slice(eq + 1).trim()
    if (name) map[name] = decodeURIComponent(val)
  }
  return map
}

function signSessionId(sessionId: string, key: Buffer): string {
  const sig = createHmac('sha256', key).update(sessionId).digest('base64url')
  return `${sessionId}.${sig}`
}

function verifySignedSessionCookie(
  rawCookie: string | undefined,
  key: Buffer,
): string | null {
  if (!rawCookie) return null
  const dot = rawCookie.lastIndexOf('.')
  if (dot <= 0) return null
  const sessionId = rawCookie.slice(0, dot)
  const providedSig = rawCookie.slice(dot + 1)
  const expectedSig = createHmac('sha256', key)
    .update(sessionId)
    .digest('base64url')

  const a = Buffer.from(providedSig, 'utf8')
  const b = Buffer.from(expectedSig, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null
  }
  return sessionId
}

function isLoopbackUrlOrAbsent(rawHeader: string | undefined): boolean {
  if (!rawHeader) return true
  try {
    const parsed = new URL(rawHeader)
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]'
    )
  } catch {
    return false
  }
}

function resolveRequestOrigin(req: IncomingMessage): string {
  const host = req.headers.host || '127.0.0.1:5173'
  const hostname = host.split(':')[0]?.toLowerCase()
  const isLoopback =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  if (!isLoopback) {
    throw new SocialOAuthError(
      'Non-loopback host headers are rejected for local OAuth callbacks.',
      'provider_error',
      403,
    )
  }
  return `http://${host}`
}

function ensureSession(
  req: IncomingMessage,
  res: ServerResponse,
  signingKey: Buffer,
  createIfMissing: boolean,
): string | null {
  const cookies = parseCookies(req)
  const verified = verifySignedSessionCookie(
    cookies[SESSION_COOKIE_NAME],
    signingKey,
  )
  if (verified) return verified
  if (!createIfMissing) return null

  const newSessionId = randomBytes(24).toString('base64url')
  const signed = signSessionId(newSessionId, signingKey)
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
  )
  return newSessionId
}

/**
 * Handles /api/social/* endpoints with signed HttpOnly session cookies, CSRF validation,
 * single-use OAuth state, strict redirect URI verification, and zero secret exposure.
 */
export async function handleSocialApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  service: SocialIntegrationService = getSharedSocialService(),
): Promise<boolean> {
  const rawUrl = req.url || '/'
  const urlObj = new URL(rawUrl, 'http://127.0.0.1')
  const { pathname } = urlObj

  if (!pathname.startsWith('/api/social')) {
    return false
  }

  if (
    !isLoopbackUrlOrAbsent(req.headers.origin) ||
    !isLoopbackUrlOrAbsent(req.headers.referer)
  ) {
    sendJson(res, 403, { error: 'Unauthorized origin for social account API.' })
    return true
  }

  // Explicitly reject client-supplied userId overrides to enforce server session ownership
  if (urlObj.searchParams.has('userId')) {
    sendJson(res, 403, {
      error: 'Client-supplied userId parameters are not permitted.',
    })
    return true
  }

  const { key: signingKey } = resolveSocialEncryptionKey()

  try {
    const requestOrigin = resolveRequestOrigin(req)

    // GET /api/social/accounts
    if (pathname === '/api/social/accounts' && req.method === 'GET') {
      const sessionId = ensureSession(req, res, signingKey, true)!
      sendJson(res, 200, service.getSnapshot(sessionId, requestOrigin))
      return true
    }

    // GET /api/social/oauth/:platform/callback
    const callbackMatch = pathname.match(
      /^\/api\/social\/oauth\/([^/]+)\/callback$/,
    )
    if (callbackMatch && req.method === 'GET') {
      const platform = decodeURIComponent(callbackMatch[1]) as SocialPlatformId
      if (!VALID_PLATFORMS.has(platform)) {
        sendJson(res, 400, { error: `Unsupported platform "${platform}".` })
        return true
      }

      const sessionId = ensureSession(req, res, signingKey, false)
      const redirectToSocial = (params: Record<string, string>) => {
        const dest = new URL('/social', requestOrigin)
        for (const [k, v] of Object.entries(params)) {
          dest.searchParams.set(k, v)
        }
        res.statusCode = 302
        res.setHeader('Location', dest.pathname + dest.search)
        res.end()
      }

      if (!sessionId) {
        redirectToSocial({
          oauth_platform: platform,
          oauth_status: 'error',
          oauth_error:
            'Missing or invalid browser session cookie during OAuth callback. Please start the connection again from AstroCut.',
        })
        return true
      }

      try {
        const account = await service.completeOAuthCallback({
          platform,
          ownerSessionId: sessionId,
          requestOrigin,
          code: urlObj.searchParams.get('code') ?? undefined,
          state: urlObj.searchParams.get('state') ?? undefined,
          oauthError: urlObj.searchParams.get('error') ?? undefined,
          oauthErrorDescription:
            urlObj.searchParams.get('error_description') ?? undefined,
        })
        redirectToSocial({
          oauth_platform: platform,
          oauth_status: 'connected',
          oauth_account: account.accountName,
        })
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Social authorization callback failed.'
        redirectToSocial({
          oauth_platform: platform,
          oauth_status: 'error',
          oauth_error: msg,
        })
      }
      return true
    }

    // Mutating API endpoints require valid CSRF header + verified session cookie
    if (req.headers[CSRF_HEADER_NAME] !== '1') {
      sendJson(res, 403, { error: 'Missing required CSRF protection header.' })
      return true
    }

    const sessionId = ensureSession(req, res, signingKey, false)
    if (!sessionId) {
      sendJson(res, 401, {
        error: 'No valid session cookie. Reload Social Accounts first.',
      })
      return true
    }

    // POST /api/social/oauth/:platform/start
    const startMatch = pathname.match(/^\/api\/social\/oauth\/([^/]+)\/start$/)
    if (startMatch && req.method === 'POST') {
      const platform = decodeURIComponent(startMatch[1]) as SocialPlatformId
      if (!VALID_PLATFORMS.has(platform)) {
        sendJson(res, 400, { error: `Unsupported platform "${platform}".` })
        return true
      }

      const started = service.startAuthorization({
        platform,
        ownerSessionId: sessionId,
        requestOrigin,
      })
      sendJson(res, 200, {
        authorizationUrl: started.authorizationUrl,
        redirectUri: started.redirectUri,
      })
      return true
    }

    // POST /api/social/accounts/:connectionId/verify
    const verifyMatch = pathname.match(
      /^\/api\/social\/accounts\/([^/]+)\/verify$/,
    )
    if (verifyMatch && req.method === 'POST') {
      const connectionId = decodeURIComponent(verifyMatch[1])
      const account = await service.verifyConnection({
        connectionId,
        ownerSessionId: sessionId,
      })
      sendJson(res, 200, {
        account,
        snapshot: service.getSnapshot(sessionId, requestOrigin),
      })
      return true
    }

    // DELETE /api/social/accounts/:connectionId
    const deleteMatch = pathname.match(/^\/api\/social\/accounts\/([^/]+)$/)
    if (deleteMatch && req.method === 'DELETE') {
      const connectionId = decodeURIComponent(deleteMatch[1])
      const outcome = await service.disconnectAccount({
        connectionId,
        ownerSessionId: sessionId,
      })
      sendJson(res, 200, {
        ...outcome,
        snapshot: service.getSnapshot(sessionId, requestOrigin),
      })
      return true
    }

    sendJson(res, 404, { error: `Unknown social endpoint: ${pathname}` })
    return true
  } catch (err) {
    const status = err instanceof SocialOAuthError ? err.statusCode : 500
    const rawMsg =
      err instanceof Error ? err.message : 'Unexpected social OAuth error.'
    const safeMsg = redactSecrets(rawMsg, service.store.getAllSecretTokens())
    sendJson(res, status, { error: safeMsg })
    return true
  }
}
