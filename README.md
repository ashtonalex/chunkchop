<p align="center">
  <h1 align="center">🪓 ChunkChop</h1>
  <p align="center"><strong>The Intelligent Task Manager</strong></p>
  <p align="center">AI-Powered Resource Monitoring for Windows</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows-blue?style=flat-square&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/Electron-30.0-47848F?style=flat-square&logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.2-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-5.1-646CFF?style=flat-square&logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## Introduction

**ChunkChop** redefines the Task Manager experience for Windows users. Say goodbye to "End Task" anxiety. ChunkChop uses **Large Language Model (LLM) analysis** to intelligently classify running processes, giving you clear **"Safe to Kill"** recommendations backed by AI confidence.

For power users and engineers, ChunkChop goes deeper with a dedicated **Dev Mode** that provides detailed memory profiling, visualising Private Working Set vs. Total Working Set to help identify memory leaks and shared library issues.

### Why ChunkChop?

- **AI-Powered Decisions:** Stop guessing. Get instant, intelligent classification of every process as Safe, Bloat, or Critical.
- **Visual Clarity:** Interactive Treemap visualization makes resource hogs immediately obvious. Size represents RAM, color represents risk.
- **Deep Insights:** Engineers can toggle Dev Mode for memory stack analysis, spotting leaks and inefficiencies at a glance.
- **Built-in Safety:** Hardcoded protection for critical system processes ensures you never accidentally crash your system.

---

## Key Features

### Visual Resource Map
An interactive **Treemap** powered by Recharts provides an intuitive visualisation of your system's resource usage:
- **Size** = RAM consumption (larger blocks = more memory)
- **Color** = Risk Level (Critical, Bloat, Safe, Unknown, Unanalysed)
- Click any process to inspect details and take action

### AI Copilot Analysis
Integrates with **OpenRouter** (Google GPT-OSS-20B model) for intelligent process classification:
- **Safe:** Background processes and user applications safe to terminate
- **Bloat:** Resource-heavy processes that may be redundant
- **Critical:** Essential system processes that should never be killed

### Hybrid Data Pipeline
Combines multiple data sources for maximum accuracy:
- **`systeminformation`** for bulk process metadata collection
- **Native PowerShell spawning** for precise **Private Working Set (PWS)** metrics
- Real-time polling with configurable intervals

### Smart Caching
Uses **`better-sqlite3`** to cache LLM analysis results locally:
- Minimises API costs by avoiding redundant analysis
- Reduces latency for previously analyzed processes
- Persistent storage survives application restarts

### Dev Mode (Memory Profiler)
A toggleable advanced mode for engineers featuring:
- **Stacked Bar Charts** visualising Private Working Set vs. Total Working Set (Shared Delta)
- Memory leak detection through pattern analysis
- Shared library issue identification
- Detailed process classification: `Leak`, `Inefficient`, `Normal`, `Suspicious`

### Safe-Guard Logic
Hardcoded protection for kernel and system processes:
- PIDs `0` and `4` (System Idle, System) are locked from termination
- Visual indicators for protected processes
- Prevents accidental system crashes

---

## Tech Stack

| Category | Technologies |
|----------|--------------|
| **Core** | Electron 30, React 18, Vite 5, TypeScript 5 |
| **UI/Styling** | TailwindCSS 4, Recharts 3 |
| **Backend/Data** | `systeminformation`, `child_process` (PowerShell), `better-sqlite3` |
| **AI** | OpenRouter API (Google GPT-OSS-20B), Google Generative AI (Gemini) |
| **Storage** | `electron-store` for settings, SQLite for analysis cache |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18.0.0 or higher
- **Windows 10/11** (PowerShell is required for memory metrics)
- **OpenRouter API Key** (or Gemini API Key)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/chunkchop.git
   cd chunkchop
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Setup

Configure API keys through the in-app Settings modal after launching.

### Development

Run the application in development mode with hot-reload:

```bash
npm run dev
```

### Building

Build the production application:

```bash
npm run build
```

Built artifacts will be placed in the `release/` directory.

---

## Architecture Overview

ChunkChop uses a **hybrid architecture** that separates concerns between the Electron main process and the React renderer:

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  PowerShell     │  │  SQLite Cache   │  │   OpenRouter/   │  │
│  │  Service        │  │  (better-sqlite3)│ │   Gemini API    │  │
│  │  (PWS Metrics)  │  │                 │  │                 │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                ▼                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              systeminformation (Process Data)           │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │ IPC Bridge (contextBridge)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   TreemapViz    │  │  InspectorPane  │  │   DevModePage   │  │
│  │   (Recharts)    │  │  (Process Info) │  │ (Memory Charts) │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              React State Management                     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Main Process (`electron/main.ts`)
- **OS Bridging:** Interfaces with Windows through PowerShell for accurate memory metrics
- **Database:** Manages SQLite cache for LLM analysis persistence
- **AI Service:** Handles API calls to OpenRouter/Gemini with retry middleware
- **Process Monitoring:** Polls `systeminformation` for real-time process data

### IPC Bridge (`electron/preload.ts`)
- Securely exposes main process functions to the renderer
- Uses `contextBridge` for safe inter-process communication
- Supports `invoke`, `on`, `off`, and `send` patterns

### Renderer Process (`src/`)
- **React Application:** Handles all UI rendering and user interaction
- **Visualization:** Treemap and stacked bar charts via Recharts
- **State Management:** React hooks for process data and analysis results

---

## 📁 Project Structure

```
chunkchop/
├── electron/                 
│   ├── main.ts               # Application entry point
│   ├── preload.ts            # IPC bridge
│   ├── services/             # Backend services
│   │   ├── AIService.ts      # AI orchestration
│   │   ├── Database.ts       # SQLite cache
│   │   └── middleware/       # API providers
│   │       ├── GeminiProvider.ts
│   │       └── OpenRouterProvider.ts
│   └── utils/                # Utilities
│       ├── PowerShellService.ts
│       └── ProcessUtils.ts
├── src/                      # React renderer
│   ├── App.tsx               # Main application component
│   ├── components/           # UI components
│   │   ├── TreemapViz.tsx    # Treemap visualization
│   │   ├── InspectorPane.tsx # Process details panel
│   │   ├── DevModePage.tsx   # Dev Mode UI
│   │   ├── MemoryBreakdownChart.tsx
│   │   └── ...
│   └── types.ts             # TypeScript interfaces
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── electron-builder.json5
```

---

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Build production application |
| `npm run lint` | Run ESLint on TypeScript files |
| `npm run preview` | Preview production build locally |

---

## 🔐 Security Notes

- API keys are stored securely using `electron-store`
- The preload script uses `contextBridge` for secure IPC
- Critical system processes (PID 0, 4) are protected from termination
- PowerShell commands are executed in controlled, sandboxed contexts

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>ChunkChop</strong> — Smarter process management through AI.
</p>
