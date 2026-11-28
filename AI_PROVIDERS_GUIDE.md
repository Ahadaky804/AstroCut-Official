# AstroCut Universal Multi-Provider AI Architecture Guide

AstroCut supports a provider-independent, server-proxied AI architecture so users can connect local models (Ollama) or cloud APIs without vendor lock-in or exposing API keys to browser JavaScript.

---

## 1. Architecture Overview

- **Server-Side AI Proxy (`server/`):**
  - Mounted into Vite's dev/preview server at `/api/ai/*` via [`vite.config.ts`](file:///d:/AstroCut/vite.config.ts) and runnable standalone via `npm run start` ([`server/standalone.ts`](file:///d:/AstroCut/server/standalone.ts)).
  - Reads `.env` / `.env.local` and server config (`.astrocut/providers.local.json`, gitignored).
  - Never returns raw API keys to the browser; masks keys (`AIza••••7890`) and redacts secrets from error messages.
  - Protects endpoints using loopback origin checks and optional `ASTROCUT_API_TOKEN`.
- **Frontend Client (`src/services/aiClient.ts`):**
  - Communicates only with `/api/ai/*` endpoints.
  - Stores **zero** API keys in `localStorage`, `IndexedDB`, or React bundles.

---

## 2. Supported Providers & Official API Adapters

All 9 provider entries are implemented with dedicated protocol adapters:

| Priority | Provider | Adapter | Official API Format | Local / Cloud |
| --- | --- | --- | --- | --- |
| 1 | Google Gemini | `geminiAdapter` | `/v1beta/models`, `:generateContent` (`x-goog-api-key`) | Cloud |
| 2 | OpenAI | `openAiCompatibleAdapter` | `/v1/models`, `/v1/chat/completions` (`Bearer`) | Cloud |
| 3 | Anthropic Claude | `anthropicAdapter` | `/v1/models`, `/v1/messages` (`x-api-key`, `anthropic-version`) | Cloud |
| 4 | Groq | `openAiCompatibleAdapter` | `api.groq.com/openai/v1` | Cloud |
| 5 | OpenRouter | `openAiCompatibleAdapter` | `openrouter.ai/api/v1` | Cloud |
| 6 | DeepSeek | `openAiCompatibleAdapter` | `api.deepseek.com` | Cloud |
| 7 | Mistral | `openAiCompatibleAdapter` | `api.mistral.ai/v1` | Cloud |
| 8 | Ollama (Local) | `ollamaAdapter` | `http://localhost:11434/api/tags`, `/api/chat` | Local (Zero API Cost) |
| 9 | Custom OpenAI-Compatible | `openAiCompatibleAdapter` | Configurable base URL, key, and model | Local or Cloud |

---

## 3. Environment Variables & API Key Configuration

1. Copy [`.env.example`](file:///d:/AstroCut/.env.example) to `.env.local` (never commit `.env` or `.env.local`):

   ```env
   GEMINI_API_KEY=your_gemini_key_here
   OPENAI_API_KEY=
   ANTHROPIC_API_KEY=
   GROQ_API_KEY=
   OPENROUTER_API_KEY=
   DEEPSEEK_API_KEY=
   MISTRAL_API_KEY=
   OLLAMA_BASE_URL=http://localhost:11434
   ```

2. Alternatively, add or update keys in **AI Provider Settings** (`/providers`).
   - Keys entered in the UI are sent once to the local Node server and stored in `.astrocut/providers.local.json`.
   - **Security Limitation:** `.astrocut/providers.local.json` is plain server-side JSON on your local disk and is **not encrypted at rest**. On shared machines, prefer OS/process environment variables instead.

---

## 4. Operating Modes & Fallback

- **Mode A: Manual**
  - Uses the user's explicitly selected provider and model (or configured task override).
  - Never silently switches providers if the selected provider fails.
- **Mode B: Automatic**
  - Evaluates enabled, configured providers using task compatibility, user priority order, and temporary rate-limit/connection cooldowns.
  - When **Enable Automatic Fallback** is active, AstroCut attempts the next eligible provider if the preferred provider fails.
  - Studio displays the actual provider, model, local/cloud indicator, fallback status, and API-reported token counts.

---

## 5. Task-Specific Model Routing

In **AI Provider Settings** (`/providers`), users can route each task to `"Use Default / Automatic"` or a specific `(Provider, Model)` pair:
- Titles & Descriptions
- Captions & Hashtags
- Translation & Roman Urdu / Hinglish Adaptation
- Transcript Cleanup (prepared for Phase 7)
- Video Summaries (explicitly gated behind video/audio understanding in Phase 7; text-only endpoints will not fabricate video summaries)

---

## 6. Custom OpenAI-Compatible Providers & Adding Adapters

- **Custom Endpoints (No Code):** Click **Add Custom Provider** on `/providers` and enter a Name, Base URL (e.g. `http://127.0.0.1:1234/v1` for LM Studio), optional API key, and Default Model.
- **New Built-In Adapters (Code):** Implement `ServerAiAdapter` in `server/providers/`, register the format in `server/providerRegistry.ts`, and add its metadata entry to `BUILT_IN_PROVIDERS`.
