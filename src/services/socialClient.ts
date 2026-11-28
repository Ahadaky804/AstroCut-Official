import type {
  SocialAccountsSnapshot,
  SocialConnectedAccountPublic,
  SocialPlatformId,
} from '../types/social'

const CSRF_HEADER = { 'X-AstroCut-CSRF': '1' }

async function parseSocialResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  if (!res.ok) {
    const msg =
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `Social API failed with HTTP ${res.status}.`
    throw new Error(msg)
  }

  if (parsed === null) {
    throw new Error('Social API returned an empty or invalid JSON response.')
  }

  return parsed as T
}

/**
 * Frontend API client for AstroCut server-side OAuth.
 * Access tokens, refresh tokens, and client secrets never leave the server.
 */
export const socialClient = {
  async getSnapshot(): Promise<SocialAccountsSnapshot> {
    const res = await fetch('/api/social/accounts', {
      method: 'GET',
      credentials: 'same-origin',
    })
    return parseSocialResponse<SocialAccountsSnapshot>(res)
  },

  async startOAuth(
    platform: SocialPlatformId,
  ): Promise<{ authorizationUrl: string; redirectUri: string }> {
    const res = await fetch(
      `/api/social/oauth/${encodeURIComponent(platform)}/start`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...CSRF_HEADER,
        },
      },
    )
    return parseSocialResponse<{ authorizationUrl: string; redirectUri: string }>(
      res,
    )
  },

  async verifyConnection(connectionId: string): Promise<{
    account: SocialConnectedAccountPublic
    snapshot: SocialAccountsSnapshot
  }> {
    const res = await fetch(
      `/api/social/accounts/${encodeURIComponent(connectionId)}/verify`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...CSRF_HEADER,
        },
      },
    )
    return parseSocialResponse<{
      account: SocialConnectedAccountPublic
      snapshot: SocialAccountsSnapshot
    }>(res)
  },

  async disconnectConnection(connectionId: string): Promise<{
    revokedAtProvider: boolean
    note?: string
    snapshot: SocialAccountsSnapshot
  }> {
    const res = await fetch(
      `/api/social/accounts/${encodeURIComponent(connectionId)}`,
      {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          ...CSRF_HEADER,
        },
      },
    )
    return parseSocialResponse<{
      revokedAtProvider: boolean
      note?: string
      snapshot: SocialAccountsSnapshot
    }>(res)
  },
}
