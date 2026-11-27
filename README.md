# AstroCut

AstroCut is an AI-powered video content management platform.

This repository currently contains **Phase 1: Project Foundation** — a clean, modular frontend shell built with React, Vite, TypeScript, Tailwind CSS, React Router, and Lucide React.

## Tech Stack

- **Framework:** React + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (v4 via `@tailwindcss/vite`)
- **Routing:** React Router (`react-router-dom`)
- **Icons:** Lucide React (`lucide-react`)
- **Code Quality:** ESLint (flat config) + strict TypeScript

## Prerequisites

- **Node.js** (LTS recommended; tested with Node.js v26.13.1)
- **npm** (bundled with Node.js)

> **Windows PowerShell note:** If PowerShell blocks `npm` because script execution is restricted (`npm.ps1 cannot be loaded`), run commands using `npm.cmd` (for example `npm.cmd install` and `npm.cmd run dev`), or use Command Prompt (`cmd.exe`).

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open the local URL printed by Vite (typically `http://localhost:5173`) in your browser.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run TypeScript project checks (`tsc -b`) and build for production |
| `npm run lint` | Run ESLint across the repository |
| `npm run typecheck` | Run TypeScript type checks without emitting files |
| `npm run preview` | Preview the production build locally |

## Project Structure

```text
src/
├── app/                 # Application root component and router definition
│   ├── App.tsx
│   └── router.tsx
├── components/
│   ├── layout/          # Responsive AppShell, Header, and Sidebar
│   └── ui/              # Reusable UI primitives (Card)
├── config/              # Static app metadata and navigation definitions
├── pages/               # Route views (DashboardPage, SettingsPage, NotFoundPage)
├── styles/              # Global Tailwind CSS v4 entry
├── types/               # Shared TypeScript interfaces
└── main.tsx             # Application mount point
```

## Phase 1 Scope & Security Hygiene

- Phase 1 provides only the responsive application shell, routing, linting, build tooling, and dashboard placeholder.
- Media processing, AI generation, transcription, scheduling, social integrations, and analytics belong to later phases and are not implemented here.
- Never commit `.env` files, credentials, API keys, `node_modules/`, build outputs, or private media files.
