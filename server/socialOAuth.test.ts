import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  decryptJsonPayload,
  encryptJsonPayload,
  resolveSocialEncryptionKey,
} from './social/cryptoVault.ts'
import { SocialIntegrationService } from './social/socialService.ts'
import { handleSocialApiRequest } from './socialMiddleware.ts'

async function withMockOAuthServers(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address() as { port: number }
  try {
    await fn(`http://127.0.0.1:${addr.port}`)
  } finally {
    server.close()
  }
}

async function withMiddlewareServer(
  service: SocialIntegrationService,
  fn: (appOrigin: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(async (req, res) => {
    const handled = await handleSocialApiRequest(req, res, service)
    if (!handled) {
      res.statusCode = 404
      res.end()
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address() as { port: number }
  try {
    await fn(`http://127.0.0.1:${addr.port}`)
  } finally {
    server.close()
  }
}

async function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const backup: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(vars)) {
    backup[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    await fn()
  } finally {
    for (const [k, v] of Object.entries(backup)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

describe('Phase 9 — Social Media Account Integration & OAuth Security', () => {
  it('encrypts/decrypts payloads with AES-256-GCM and rejects tampered ciphertext/tags', () => {
    const dir = mkdtempSync(join(tmpdir(), 'astrocut-vault-'))
    try {
      const { key } = resolveSocialEncryptionKey(dir)
      const cipher = encryptJsonPayload(
        { accessToken: 'secret-token-123', refreshToken: 'ref-456' },
        key,
      )
      assert.equal(cipher.includes('secret-token-123'), false)

      const decoded = decryptJsonPayload<{ accessToken: string }>(cipher, key)
      assert.equal(decoded.accessToken, 'secret-token-123')

      const parsed = JSON.parse(cipher) as {
        version: number
        iv: string
        authTag: string
        ciphertext: string
      }
      const tampered = JSON.stringify({
        ...parsed,
        ciphertext: Buffer.from('tampered-bytes').toString('base64'),
      })
      assert.throws(() => decryptJsonPayload(tampered, key))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports honest setup_required state when OAuth credentials are missing and blocks starting OAuth', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'astrocut-social-missing-'))
    try {
      await withEnv(
        {
          GOOGLE_CLIENT_ID: undefined,
          GOOGLE_CLIENT_SECRET: undefined,
          META_APP_ID: undefined,
          META_APP_SECRET: undefined,
          TIKTOK_CLIENT_KEY: undefined,
          TIKTOK_CLIENT_SECRET: undefined,
        },
        async () => {
          const service = new SocialIntegrationService(dir)
          await withMiddlewareServer(service, async (appOrigin) => {
            const snapRes = await fetch(`${appOrigin}/api/social/accounts`)
            assert.equal(snapRes.status, 200)
            const cookie = snapRes.headers.get('set-cookie')?.split(';')[0] ?? ''
            assert.ok(cookie.includes('astrocut_sid='))

            const snap = (await snapRes.json()) as {
              platforms: Array<{ platform: string; status: string; configured: boolean }>
            }
            assert.equal(snap.platforms.length, 3)
            assert.equal(
              snap.platforms.every((p) => p.status === 'setup_required' && !p.configured),
              true,
            )

            // Rejects missing CSRF header
            const noCsrf = await fetch(`${appOrigin}/api/social/oauth/youtube/start`, {
              method: 'POST',
              headers: { Cookie: cookie },
            })
            assert.equal(noCsrf.status, 403)

            // Rejects client-supplied userId
            const withUserId = await fetch(
              `${appOrigin}/api/social/accounts?userId=attacker`,
              { headers: { Cookie: cookie } },
            )
            assert.equal(withUserId.status, 403)

            // Fails honestly when credentials are missing
            const startRes = await fetch(`${appOrigin}/api/social/oauth/youtube/start`, {
              method: 'POST',
              headers: { Cookie: cookie, 'X-AstroCut-CSRF': '1' },
            })
            assert.equal(startRes.status, 400)
          })
        },
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('completes OAuth flows for YouTube, Instagram Professional, and TikTok concurrently, validates state/CSRF/tokens, redacts secrets, and revokes on disconnect', async () => {
    const revokedTokens: string[] = []
    let igAccountType = 'BUSINESS'

    await withMockOAuthServers(
      (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        let body = ''
        req.on('data', (c) => {
          body += c.toString()
        })
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json')

          // --- Google / YouTube ---
          if (url.pathname === '/google/token') {
            const form = new URLSearchParams(body)
            const code = form.get('code')
            if (code === 'bad-code') {
              res.statusCode = 400
              res.end(
                JSON.stringify({
                  error: 'invalid_grant',
                  error_description: 'Code was invalid or expired (secret: mock-google-secret)',
                }),
              )
              return
            }
            res.end(
              JSON.stringify({
                access_token: 'yt-access-secret-token-999',
                refresh_token: 'yt-refresh-secret-token-999',
                expires_in: 3600,
                scope: 'https://www.googleapis.com/auth/youtube.readonly',
              }),
            )
            return
          }
          if (url.pathname === '/youtube/channels') {
            res.end(
              JSON.stringify({
                items: [
                  {
                    id: 'UC_ASTROCUT_01',
                    snippet: {
                      title: 'AstroCut Studio',
                      customUrl: '@astrocut',
                      thumbnails: { default: { url: 'https://example.com/yt.jpg' } },
                    },
                  },
                ],
              }),
            )
            return
          }
          if (url.pathname === '/google/revoke') {
            const tok = url.searchParams.get('token')
            if (tok) revokedTokens.push(tok)
            res.end('{}')
            return
          }

          // --- Meta / Instagram ---
          if (url.pathname === '/ig/token') {
            res.end(
              JSON.stringify({
                access_token: 'ig-access-secret-888',
                expires_in: 3600,
                permissions: 'instagram_business_basic',
              }),
            )
            return
          }
          if (url.pathname === '/ig/me' && req.method === 'GET') {
            res.end(
              JSON.stringify({
                user_id: 'ig_prof_777',
                username: 'astrocut.creator',
                name: 'AstroCut Creator',
                account_type: igAccountType,
                profile_picture_url: 'https://example.com/ig.jpg',
              }),
            )
            return
          }
          if (url.pathname === '/ig/me/permissions' && req.method === 'DELETE') {
            revokedTokens.push('ig-access-secret-888')
            res.end(JSON.stringify({ success: true }))
            return
          }

          // --- TikTok ---
          if (url.pathname === '/tiktok/token') {
            const form = new URLSearchParams(body)
            if (form.get('grant_type') === 'refresh_token') {
              res.statusCode = 401
              res.end(
                JSON.stringify({
                  error: 'invalid_grant',
                  error_description: 'TikTok refresh token expired',
                }),
              )
              return
            }
            res.end(
              JSON.stringify({
                access_token: 'tt-access-secret-555',
                refresh_token: 'tt-refresh-secret-555',
                expires_in: 3600,
                scope: 'user.info.basic',
              }),
            )
            return
          }
          if (url.pathname === '/tiktok/userinfo') {
            if (req.headers.authorization === 'Bearer tt-access-secret-555') {
              res.end(
                JSON.stringify({
                  error: { code: 'ok' },
                  data: {
                    user: {
                      open_id: 'tt_open_321',
                      display_name: 'AstroCut TikTok',
                      username: 'astrocut.tok',
                      avatar_url: 'https://example.com/tt.jpg',
                    },
                  },
                }),
              )
              return
            }
            res.statusCode = 401
            res.end(JSON.stringify({ error: { code: 'access_token_invalid', message: 'Expired' } }))
            return
          }
          if (url.pathname === '/tiktok/revoke') {
            revokedTokens.push('tt-access-secret-555')
            res.end('{}')
            return
          }

          res.statusCode = 404
          res.end()
        })
      },
      async (mockBase) => {
        const dir = mkdtempSync(join(tmpdir(), 'astrocut-social-full-'))
        try {
          await withEnv(
            {
              ASTROCUT_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
              GOOGLE_CLIENT_ID: 'mock-google-id',
              GOOGLE_CLIENT_SECRET: 'mock-google-secret',
              GOOGLE_OAUTH_TOKEN_URL: `${mockBase}/google/token`,
              GOOGLE_OAUTH_REVOKE_URL: `${mockBase}/google/revoke`,
              YOUTUBE_CHANNELS_API_URL: `${mockBase}/youtube/channels`,
              META_APP_ID: 'mock-meta-id',
              META_APP_SECRET: 'mock-meta-secret',
              META_INSTAGRAM_TOKEN_URL: `${mockBase}/ig/token`,
              META_INSTAGRAM_GRAPH_ME_URL: `${mockBase}/ig/me`,
              TIKTOK_CLIENT_KEY: 'mock-tt-key',
              TIKTOK_CLIENT_SECRET: 'mock-tt-secret',
              TIKTOK_OAUTH_TOKEN_URL: `${mockBase}/tiktok/token`,
              TIKTOK_USER_INFO_URL: `${mockBase}/tiktok/userinfo`,
              TIKTOK_OAUTH_REVOKE_URL: `${mockBase}/tiktok/revoke`,
            },
            async () => {
              const service = new SocialIntegrationService(dir)
              await withMiddlewareServer(service, async (appOrigin) => {
                // Acquire signed session cookie for User A
                const sRes = await fetch(`${appOrigin}/api/social/accounts`)
                const cookieA = sRes.headers.get('set-cookie')!.split(';')[0]

                // Second browser session User B (for cross-session state & ownership checks)
                const sResB = await fetch(`${appOrigin}/api/social/accounts`)
                const cookieB = sResB.headers.get('set-cookie')!.split(';')[0]

                // 1. Start YouTube OAuth -> inspect scopes & complete callback
                const ytStart = await fetch(`${appOrigin}/api/social/oauth/youtube/start`, {
                  method: 'POST',
                  headers: { Cookie: cookieA, 'X-AstroCut-CSRF': '1' },
                })
                assert.equal(ytStart.status, 200)
                const ytStartBody = (await ytStart.json()) as { authorizationUrl: string }
                const ytAuthUrl = new URL(ytStartBody.authorizationUrl)
                assert.equal(
                  ytAuthUrl.searchParams.get('scope'),
                  'https://www.googleapis.com/auth/youtube.readonly',
                )
                const ytState = ytAuthUrl.searchParams.get('state')!

                // Wrong session cannot redeem User A's state
                const wrongSessionCb = await fetch(
                  `${appOrigin}/api/social/oauth/youtube/callback?code=good&state=${encodeURIComponent(ytState)}`,
                  { headers: { Cookie: cookieB }, redirect: 'manual' },
                )
                assert.equal(wrongSessionCb.status, 302)
                assert.match(wrongSessionCb.headers.get('location') || '', /oauth_status=error/)

                // Retry with User A -> fails because state was single-use consumed
                const replayCb = await fetch(
                  `${appOrigin}/api/social/oauth/youtube/callback?code=good&state=${encodeURIComponent(ytState)}`,
                  { headers: { Cookie: cookieA }, redirect: 'manual' },
                )
                assert.match(replayCb.headers.get('location') || '', /oauth_status=error/)

                // Invalid code triggers secret-redacted error
                const badCodeStart = (await (
                  await fetch(`${appOrigin}/api/social/oauth/youtube/start`, {
                    method: 'POST',
                    headers: { Cookie: cookieA, 'X-AstroCut-CSRF': '1' },
                  })
                ).json()) as { authorizationUrl: string }
                const badCodeState = new URL(badCodeStart.authorizationUrl).searchParams.get('state')!
                const badCodeCb = await fetch(
                  `${appOrigin}/api/social/oauth/youtube/callback?code=bad-code&state=${encodeURIComponent(badCodeState)}`,
                  { headers: { Cookie: cookieA }, redirect: 'manual' },
                )
                const badLoc = badCodeCb.headers.get('location') || ''
                assert.match(badLoc, /oauth_status=error/)
                assert.equal(badLoc.includes('mock-google-secret'), false)
                assert.match(decodeURIComponent(badLoc), /\[REDACTED\]/)

                // Valid YouTube connection
                const okYtStart = (await (
                  await fetch(`${appOrigin}/api/social/oauth/youtube/start`, {
                    method: 'POST',
                    headers: { Cookie: cookieA, 'X-AstroCut-CSRF': '1' },
                  })
                ).json()) as { authorizationUrl: string }
                const okYtState = new URL(okYtStart.authorizationUrl).searchParams.get('state')!
                const okYtCb = await fetch(
                  `${appOrigin}/api/social/oauth/youtube/callback?code=ok&state=${encodeURIComponent(okYtState)}`,
                  { headers: { Cookie: cookieA }, redirect: 'manual' },
                )
                assert.match(okYtCb.headers.get('location') || '', /oauth_status=connected/)

                // 2. Instagram: reject PERSONAL account cleanly, accept BUSINESS account
                igAccountType = 'PERSONAL'
                const igFailStart = (await (
                  await fetch(`${appOrigin}/api/social/oauth/instagram/start`, {
                    method: 'POST',
                    headers: { Cookie: cookieA, 'X-AstroCut-CSRF': '1' },
                  })
                ).json()) as { authorizationUrl: string }
                const igFailState = new URL(igFailStart.authorizationUrl).searchParams.get('state')!
                const igFailCb = await fetch(
                  `${appOrigin}/api/social/oauth/instagram/callback?code=ig-ok&state=${encodeURIComponent(igFailState)}`,
                  { headers: { Cookie: cookieA }, redirect: 'manual' },
                )
                assert.match(
                  decodeURIComponent(igFailCb.headers.get('location') || ''),
                  /Personal/i,
                )

                igAccountType = 'BUSINESS'
                const igOkStart = (await (
                  await fetch(`${appOrigin}/api/social/oauth/instagram/start`, {
                    method: 'POST',
                    headers: { Cookie: cookieA, 'X-AstroCut-CSRF': '1' },
                  })
                ).json()) as { authorizationUrl: string }
                const igOkState = new URL(igOkStart.authorizationUrl).searchParams.get('state')!
                const igOkCb = await fetch(
                  `${appOrigin}/api/social/oauth/instagram/callback?code=ig-ok&state=${encodeURIComponent(igOkState)}`,
                  { headers: { Cookie: cookieA }, redirect: 'manual' },
                )
                assert.match(igOkCb.headers.get('location') || '', /oauth_status=connected/)

                // 3. TikTok connection + scopes + verification
                const ttStart = (await (
                  await fetch(`${appOrigin}/api/social/oauth/tiktok/start`, {
                    method: 'POST',
                    headers: { Cookie: cookieA, 'X-AstroCut-CSRF': '1' },
                  })
                ).json()) as { authorizationUrl: string }
                const ttUrl = new URL(ttStart.authorizationUrl)
                assert.equal(ttUrl.searchParams.get('scope'), 'user.info.basic')
                const ttOkCb = await fetch(
                  `${appOrigin}/api/social/oauth/tiktok/callback?code=tt-ok&state=${encodeURIComponent(ttUrl.searchParams.get('state')!)}`,
                  { headers: { Cookie: cookieA }, redirect: 'manual' },
                )
                assert.match(ttOkCb.headers.get('location') || '', /oauth_status=connected/)

                // Verify all 3 connected simultaneously and ZERO tokens exposed in API snapshot or raw disk file
                const snapText = await (
                  await fetch(`${appOrigin}/api/social/accounts`, {
                    headers: { Cookie: cookieA },
                  })
                ).text()
                assert.equal(snapText.includes('yt-access-secret-token-999'), false)
                assert.equal(snapText.includes('ig-access-secret-888'), false)
                assert.equal(snapText.includes('tt-access-secret-555'), false)

                const encryptedFileRaw = readFileSync(
                  join(dir, '.astrocut', 'social.enc.json'),
                  'utf8',
                )
                assert.equal(encryptedFileRaw.includes('yt-access-secret-token-999'), false)

                const snap = JSON.parse(snapText) as {
                  platforms: Array<{ platform: string; status: string; accounts: Array<{ connectionId: string }> }>
                }
                assert.equal(
                  snap.platforms.every((p) => p.status === 'connected' && p.accounts.length === 1),
                  true,
                )

                // User B cannot disconnect User A's account
                const forbiddenDisconnect = await fetch(
                  `${appOrigin}/api/social/accounts/${encodeURIComponent('youtube:UC_ASTROCUT_01')}`,
                  {
                    method: 'DELETE',
                    headers: { Cookie: cookieB, 'X-AstroCut-CSRF': '1' },
                  },
                )
                assert.equal(forbiddenDisconnect.status, 404)

                // User A disconnects YouTube -> revokes at provider & removes local record
                const disconnectRes = await fetch(
                  `${appOrigin}/api/social/accounts/${encodeURIComponent('youtube:UC_ASTROCUT_01')}`,
                  {
                    method: 'DELETE',
                    headers: { Cookie: cookieA, 'X-AstroCut-CSRF': '1' },
                  },
                )
                assert.equal(disconnectRes.status, 200)
                assert.ok(revokedTokens.includes('yt-refresh-secret-token-999'))
              })
            },
          )
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
  })
})
