# AstroCut Phase 9 — Social Media OAuth Setup & Platform Limitations

AstroCut connects **YouTube**, **Instagram**, and **TikTok** using official OAuth 2.0 authorization code flows entirely through AstroCut's local Node backend (`/api/social/*`). Client secrets, access tokens, and refresh tokens are stored encrypted (**AES-256-GCM**) in `.astrocut/social.enc.json` (gitignored) and are never stored in `IndexedDB`, `localStorage`, or frontend JS.

---

## 1. Environment Variables (`.env.local`)

Copy `.env.example` to `.env.local` and configure the credentials you want to connect:

```env
# Optional: 64-char hex key (or strong passphrase) for AES-256-GCM vault encryption.
# If omitted locally, AstroCut generates a local key in .astrocut/social.key (0600).
ASTROCUT_ENCRYPTION_KEY=

# YouTube (Google Cloud Console -> APIs & Services -> Credentials -> Web Application)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5173/api/social/oauth/youtube/callback

# Instagram (Meta Developer Dashboard -> Instagram API with Instagram Login)
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=http://localhost:5173/api/social/oauth/instagram/callback

# TikTok (TikTok for Developers -> Login Kit v2)
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=http://localhost:5173/api/social/oauth/tiktok/callback
```

> If running the standalone production server (`npm run start` on port `4173`), register `http://127.0.0.1:4173/api/social/oauth/<platform>/callback` (or `http://localhost:4173/...`) in the provider dashboard and update `*_REDIRECT_URI` cleanly.

---

## 2. Official Scopes & Zero Publishing Yet

Phase 9 requests **read-only identification scopes only** (no upload or scheduling scopes until the publishing phase):
- **YouTube**: `https://www.googleapis.com/auth/youtube.readonly`
- **Instagram**: `instagram_business_basic`
- **TikTok**: `user.info.basic`

---

## 3. Platform Eligibility, Sandbox & App Review Requirements

- **YouTube**: Requires an active YouTube channel on the authorized Google account. During local development before Google OAuth verification, add your Google account as an approved **Test User** in Google Cloud Console's OAuth Consent Screen.
- **Instagram**: Meta retired the legacy Basic Display API in December 2024. Meta's official API supports **Instagram Professional accounts (Business or Creator)** only—**standard personal Instagram accounts are rejected**. Local testing requires adding the Instagram account as an **Instagram Tester** in the Meta App Dashboard; public release requires Meta **App Review**.
- **TikTok**: Requires a TikTok Developer app with **Login Kit** enabled. Local testing requires adding your TikTok account as a target user in TikTok **Sandbox** mode; public rollout requires TikTok **App Review**.
