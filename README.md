# AstroCut

AstroCut is an open-source, provider-independent AI video content management and publishing workspace built for local-first privacy and zero-budget development.

## Implemented Features (Phases 1–6.5)

- **Phase 1 — Project Foundation:** React, Vite, TypeScript, Tailwind CSS v4, React Router, ESLint, and modular architecture.
- **Phase 2 & Obsidian Blue Design System:** Custom CSS variable tokens, Obsidian Dark & Cool Light themes, persistent `ThemeProvider`, and reusable UI primitives (`Button`, `Card`, `Input`, `Textarea`, `Select`, `Badge`, `Modal`, `Tooltip`, `PageHeader`, `LoadingState`, `EmptyState`).
- **Phase 3 — Professional Dashboard:** Live workspace statistics, quick actions, recent videos, recent upload activity, and onboarding roadmap.
- **Phase 4 — Video Library (`/library`):** Drag-and-drop and PC/mobile upload for MP4, MOV, and WebM stored locally in IndexedDB, inline video preview, rename, delete confirmation, search, format filter, and sorting.
- **Phase 5 — AI Content Studio (`/studio`):** Video context selection, Language (`English`, `Roman Urdu`, `Hinglish`), Platform (`YouTube`, `Instagram`, `TikTok`, `Multiple Platforms`), Content Tone, editable platform copy with character counters, copy controls, and live previews.
- **Phase 6 & 6.5 — Universal Multi-Provider AI Architecture (`/providers`):**
  - Server-side `/api/ai/*` proxy keeping API keys out of browser JS, `localStorage`, and `IndexedDB`.
  - Official API adapters for **Google Gemini**, **OpenAI**, **Anthropic Claude**, **Groq**, **OpenRouter**, **DeepSeek**, **Mistral**, **Ollama (Local)**, and **Custom OpenAI-Compatible** endpoints.
  - **Manual** and **Automatic** operating modes with configurable priority, optional fallback, task-specific model routing, and transparent usage/provider reporting.

- **Phase 7 — Local Video Transcription & Processing (`/transcribe`):**
  - Local FFmpeg audio extraction for MP4, MOV, and WebM with automatic temp-file cleanup.
  - Local open-source Whisper transcription (`faster-whisper` / `openai-whisper`) supporting `Tiny`, `Base`, `Small`, and `Medium` models, CPU fallback, and safe GPU checks (never assuming Quadro P2000 CUDA compatibility).
  - Persistent IndexedDB transcript storage (`DB_VERSION = 2`), interactive timestamped segment editor with click-to-seek video playback, TXT/SRT export, separate Roman Urdu transliteration & optional English translation, and transcript-grounded AI Content Studio generation.

*(Not yet implemented: persistent Draft Management, social OAuth/publishing, and analytics belong to upcoming phases.)*

## Prerequisites

- **Node.js** (LTS recommended; tested with Node.js v26.13.1)
- **npm** (bundled with Node.js)
- **FFmpeg + Python Whisper** for local Phase 7 transcription (see [TRANSCRIPTION_SETUP.md](file:///d:/AstroCut/TRANSCRIPTION_SETUP.md))
- Optional: **Ollama** or cloud AI keys for AI Content Studio / Roman Urdu & English transforms (see [OLLAMA_SETUP.md](file:///d:/AstroCut/OLLAMA_SETUP.md) & [AI_PROVIDERS_GUIDE.md](file:///d:/AstroCut/AI_PROVIDERS_GUIDE.md))

> **Windows PowerShell note:** If PowerShell restricts `npm.ps1`, use `npm.cmd` (e.g. `npm.cmd install`, `npm.cmd run dev`).

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure AI keys (optional — see [`.env.example`](file:///d:/AstroCut/.env.example) and [`AI_PROVIDERS_GUIDE.md`](file:///d:/AstroCut/AI_PROVIDERS_GUIDE.md)):

   ```bash
   cp .env.example .env.local
   ```

3. Start the development server (mounts both the React frontend and `/api/ai/*` server endpoints):

   ```bash
   npm run dev
   ```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with `/api/ai/*` server middleware |
| `npm run build` | Run TypeScript checks (`tsc -b`) and build production bundle |
| `npm run lint` | Run ESLint across `src/` and `server/` |
| `npm run typecheck` | Run TypeScript checks without emitting files |
| `npm run test` | Run server routing & provider unit tests (`node --test`) |
| `npm run start` | Serve production `dist/` + `/api/ai/*` API via Node (`server/standalone.ts`) |

## Documentation

- [TRANSCRIPTION_SETUP.md](file:///d:/AstroCut/TRANSCRIPTION_SETUP.md) — Windows 10 setup for FFmpeg, Whisper models, CPU/Quadro P2000 notes, and troubleshooting
- [AI_PROVIDERS_GUIDE.md](file:///d:/AstroCut/AI_PROVIDERS_GUIDE.md) — Multi-provider architecture, API keys, modes, routing, and security
- [OLLAMA_SETUP.md](file:///d:/AstroCut/OLLAMA_SETUP.md) — Windows setup guide for local Ollama inference
