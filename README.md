# ChunkChop

AI-assisted Windows process monitor with a treemap view and “Safe to Kill” confidence.

[![Platform](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows&logoColor=white)](#)
[![Electron](https://img.shields.io/badge/Electron-30.x-47848F?logo=electron&logoColor=white)](#)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)

## Introduction

ChunkChop is a modern Windows desktop resource monitor built with Electron, Vite, React, and TypeScript.
It goes beyond a traditional task manager by using an LLM (Large Language Model) to analyze process names and generate:

- Risk assessments (Safe / Bloat / Critical)
- “Safe to Kill” recommendations

The goal: replace “End Task” anxiety with AI-backed confidence while still protecting known system-critical processes.

## Key Features

- **Visual Resource Map**: an interactive Treemap (Recharts) where **tile size = RAM usage** and **tile color = risk level** (`src/components/TreemapViz.tsx`).
- **AI Copilot**: process classification with **OpenRouter (primary)** and **Gemini (fallback)** (`electron/services/AIService.ts`, `electron/services/middleware/*`).
- **Smart Caching**: local SQLite cache via `better-sqlite3` to minimize repeat API calls and cost (`electron/services/Database.ts`).
- **Safe-Guard Logic**: hard protection against killing critical Windows processes like PID `0` and `4` (`electron/main.ts`).
- **Process Management**: live process list, memory + CPU metrics, selection/inspection, and termination (`src/components/ProcessList.tsx`, `src/components/InspectorPane.tsx`).

## Tech Stack

- **Desktop**: Electron
- **Renderer/UI**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Visualization**: Recharts (Treemap)
- **System telemetry**: `systeminformation`
- **Local cache**: `better-sqlite3` (SQLite)
- **Settings storage**: `electron-store` (API keys)
- **Packaging**: `electron-builder`

## Getting Started

### Prerequisites

- Windows 10/11
- Node.js (LTS recommended)
- API keys:
  - **OpenRouter API key** (required to run analysis)
  - **Gemini API key** (optional; used as fallback when configured)

### Installation

```powershell
npm install
```

Notes:

- This project uses `better-sqlite3` (native dependency). `npm install` runs `electron-builder install-app-deps` via `postinstall` to ensure Electron-compatible native modules.

### Development

```powershell
npm run dev
```

### Building for Production

```powershell
npm run build
```

## Architecture Overview

ChunkChop uses a “hybrid” Electron architecture:

```
┌──────────────────────────┐
│      Main Process        │
│  OS + DB + AI calls       │
│  - systeminformation      │
│  - better-sqlite3         │
│  - OpenRouter/Gemini      │
└───────────┬──────────────┘
            │ IPC
┌───────────▼──────────────┐
│        Preload            │
│  contextBridge IPC API    │
│  - exposes invoke/on      │
└───────────┬──────────────┘
            │
┌───────────▼──────────────┐
│     Renderer (React)      │
│  UI + Treemap + Controls  │
└──────────────────────────┘
```

### Main process responsibilities

- Poll process data every ~2s and send `processes-update` to the renderer (`electron/main.ts`).
- Enrich process list with cached AI analysis from SQLite (`electron/services/Database.ts`).
- Provide IPC handlers:
  - `kill-process` (with PID 0/4 protection)
  - `batch-analyze` (deduplicates process names, batches calls, writes results to SQLite)
  - API key storage (`save-*/get-*`) via `electron-store`

### Renderer responsibilities

- Render the process list, treemap, and inspector (`src/App.tsx`, `src/components/*`).
- Trigger batch analysis (`window.ipcRenderer.invoke('batch-analyze')`) and display logs/progress.

## Configuration

ChunkChop stores keys locally using `electron-store` (per-user app data). No `.env` file is required by default.

### Required

- **OpenRouter API key**: used for analysis (Gemini is always available as a fallback).

### Optional

- **Gemini API key**: when set, OpenRouter is attempted first; if it fails, ChunkChop falls back to Gemini.

### Local cache

- ChunkChop maintains a SQLite database at:
  - `%APPDATA%/<YourApp>/chunkchop.db` (resolved via Electron `app.getPath('userData')`)
- Analysis is cached by `process_name` in the `process_analysis` table (`electron/services/Database.ts`).

### Memory metrics (Windows)

ChunkChop uses `systeminformation` process metrics:

- `memRss` is treated as “working set”-like memory and converted to bytes for visualization (`electron/main.ts`).
- `systeminformation` does not directly expose Windows “Private Working Set”.

## License

MIT
