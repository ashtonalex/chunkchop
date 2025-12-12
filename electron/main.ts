import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import si from 'systeminformation'
import Store from 'electron-store';
import { initDB, getAnalysis } from './services/Database.js'; // Use .js extension for ESM usage in TS if needed, or rely on bundler. Electron with TS usually resolves .ts without extension or with .js if using ES modules. Let's try without extension or checking config. Vite usually handles this. But 'type': 'module' in package.json implies ESM. 
// Actually, for electron-vite, imports usually work without extensions or with proper resolution.
// Safe bet: .ts files in electron folder are compiled.
import { initGemini, analyzeProcessesBatch, isAnalyzing, ProcessInfo, initOpenRouter } from './services/AIService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const store = new Store();

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false // simplify for better-sqlite3 if needed, though ipcMain usage avoids this requirement usually.
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Always open DevTools for debugging (remove in final production)
  win.webContents.openDevTools()
}

// --- System Monitoring ---

const POLL_INTERVAL = 2000;
let monitorInterval: NodeJS.Timeout | null = null;

async function fetchProcesses() {
  if (!win || win.isDestroyed()) return;
  try {
    const processes = await si.processes();
    
    // Enrich with Analysis Data from DB cache
    // Memory Metrics Explanation (Windows):
    // - memRss (Resident Set Size): Memory currently in RAM, closest approximation to "Working Set"
    // - memVsz (Virtual Size): Total committed memory including paged to disk
    // Note: systeminformation doesn't provide Windows "Private Working Set" directly
    const enrichedList = processes.list.map((p: any) => {
      const analysis = getAnalysis(p.name);
      return { 
        ...p, 
        mem: (p.memRss || 0) * 1024, // Convert KB to Bytes (Working Set/RSS)
        memVirtual: (p.memVsz || 0) * 1024, // Convert KB to Bytes (Virtual Memory)
        memPct: p.mem, // Preserve original percentage if needed
        analysis: analysis || null 
      };
    });

    win.webContents.send('processes-update', enrichedList);
  } catch (error) {
    console.error('Failed to fetch processes:', error);
  }
}

function startMonitoring() {
  if (monitorInterval) return;
  monitorInterval = setInterval(fetchProcesses, POLL_INTERVAL);
  fetchProcesses();
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

// --- IPC Handlers ---

ipcMain.handle('kill-process', async (_event, pid: number) => {
  console.log(`Request to kill process: ${pid}`);
  if (pid === 0 || pid === 4) {
    console.warn('Attempted to kill critical system process prevented.');
    return { success: false, error: 'Cannot kill system idle or system process.' };
  }
  
  try {
    process.kill(pid);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to kill process ${pid}:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-api-key', async (_event, key: string) => {
    store.set('geminiApiKey', key);
    // Re-init Gemini with new key
    if (win) {
       initGemini(key, win.webContents);
    }
    return true;
});

ipcMain.handle('get-api-key', () => {
    return store.get('geminiApiKey');
});

ipcMain.handle('save-openrouter-api-key', async (_event, key: string) => {
    store.set('openRouterApiKey', key);
    // Re-init OpenRouter with new key
    if (win) {
       initOpenRouter(key, win.webContents);
    }
    return true;
});

ipcMain.handle('get-openrouter-api-key', () => {
    return store.get('openRouterApiKey');
});

ipcMain.handle('batch-analyze', async () => {
  if (isAnalyzing()) {
    return { success: false, error: 'Analysis already in progress' };
  }

  try {
    // Get current processes snapshot
    const processes = await si.processes();
    const totalProcesses = processes.list.length;
    
    // Filter out processes we already have analysis for
    const needAnalysis = processes.list.filter((p: any) => !getAnalysis(p.name));
    const alreadyAnalyzed = totalProcesses - needAnalysis.length;
    
    console.log(`[Main] Process analysis status: ${totalProcesses} total, ${alreadyAnalyzed} already analyzed, ${needAnalysis.length} need analysis`);
    
    if (needAnalysis.length === 0) {
      return { success: true, message: 'All processes already analyzed', count: 0 };
    }

    // Convert to ProcessInfo format
    const processInfo: ProcessInfo[] = needAnalysis.map((p: any) => ({
      name: p.name,
      cpu: p.cpu || 0,
      mem: (p.memRss || 0) / 1024 // Convert KB to MB
    }));

    console.log(`[Main] Sending ${processInfo.length} unanalyzed processes to AI service (may include duplicate process names)`);
    
    const results = await analyzeProcessesBatch(processInfo);
    
    return { 
      success: true, 
      count: results.length,
      message: `Successfully analyzed ${results.length} processes`
    };
  } catch (error: any) {
    console.error('[Main] Batch analysis failed:', error);
    return { success: false, error: error.message };
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  stopMonitoring();
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  initDB();
  
  const apiKey = store.get('geminiApiKey') as string;
  const openRouterKey = store.get('openRouterApiKey') as string;
  createWindow();
  
  if (apiKey && win) {
      initGemini(apiKey, win.webContents);
  }
  
  if (openRouterKey && win) {
      initOpenRouter(openRouterKey, win.webContents);
  }
  
  startMonitoring();
});
