import { saveAnalysis, AnalysisResult, saveDevModeAnalysis, DevModeAnalysisResult } from './Database.js';
import { GeminiProvider } from './middleware/GeminiProvider.js';
import { OpenRouterProvider } from './middleware/OpenRouterProvider.js';
import { withRetry } from './middleware/RetryMiddleware.js';
import { 
  deduplicateProcesses, 
  buildOptimizedPrompt,
  buildDevModePrompt,
  ProcessInfo
} from '../utils/ProcessUtils.js';
import { createProcessBatches } from '../utils/llmBatching.js';
import { getErrorMessage } from '../utils/ErrorUtils.js';

// Re-export ProcessInfo for consumers
export type { ProcessInfo };

// Module state
const geminiProvider = new GeminiProvider();
const openRouterProvider = new OpenRouterProvider();
let webContents: any = null;
let isProcessing = false;

export function initGemini(apiKey: string, wc: any) {
  if (!apiKey) return;
  geminiProvider.initialize(apiKey);
  webContents = wc;
}

export function initOpenRouter(apiKey: string) {
  if (!apiKey) return;
  openRouterProvider.initialize(apiKey);
}

/**
 * Analyze a batch of processes in a single API call with automatic retry
 * @param processes Array of process info to analyze
 * @returns Promise that resolves when batch analysis is complete
 */
export async function analyzeProcessesBatch(processes: ProcessInfo[]): Promise<AnalysisResult[]> {
  if (!geminiProvider.isInitialized()) {
    throw new Error('Gemini API not initialized. Please set API key first.');
  }

  if (isProcessing) {
    throw new Error('Batch analysis already in progress');
  }

  if (processes.length === 0) {
    return [];
  }

  // Deduplicate processes by name to reduce token usage
  const uniqueProcesses = deduplicateProcesses(processes);
  const duplicateInstances = processes.length - uniqueProcesses.length;
  
  if (duplicateInstances > 0) {
    const message = `Deduplication: ${processes.length} unanalyzed process instances → ${uniqueProcesses.length} unique process names (removed ${duplicateInstances} duplicate instances)`;
    console.log(`[AI Service] ${message}`);
    logToUI('info', message);
  } else {
    console.log(`[AI Service] All ${uniqueProcesses.length} unanalyzed processes have unique names, no deduplication needed`);
  }

  if (uniqueProcesses.length === 0) {
    return [];
  }

  isProcessing = true;

  try {
    // Use dynamic batching strategy (target 32 processes per batch)
    const chunks = createProcessBatches(uniqueProcesses);
    
    if (chunks.length > 1) {
      const message = `Split ${uniqueProcesses.length} processes into ${chunks.length} batches using dynamic batching`;
      console.log(`[AI Service] ${message}`);
      logToUI('info', message);
    }

    const allResults: AnalysisResult[] = [];

    // Process each chunk sequentially
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const message = `Processing batch ${i + 1}/${chunks.length} (${chunk.length} processes)...`;
      console.log(`[AI Service] ${message}`);
      logToUI('info', message);
      
      // Notify UI of batch progress
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('batch-analysis-progress', {
          currentBatch: i + 1,
          totalBatches: chunks.length,
          processesInBatch: chunk.length
        });
      }

      const results = await analyzeProcessChunk(chunk);
      allResults.push(...results);
      
      // Save results immediately after processing the chunk
      saveBatchAnalysis(results);
      console.log(`[AI Service] Saved ${results.length} analysis results to database`);
    }

    // Notify UI of completion
    if (webContents && !webContents.isDestroyed()) {
      webContents.send('batch-analysis-complete', {
        count: allResults.length,
        timestamp: new Date().toISOString()
      });
    }

    return allResults;

  } catch (error) {
    console.error('[AI Service] Batch analysis failed:', error);
    throw error;
  } finally {
    isProcessing = false;
  }
}

/**
 * Analyze a single chunk of processes with provider fallback and retry logic
 */
async function analyzeProcessChunk(processes: ProcessInfo[]): Promise<AnalysisResult[]> {
  const prompt = buildOptimizedPrompt(processes);
  let openRouterError: any = null;

  // 1. Try OpenRouter first (if initialized)
  if (openRouterProvider.isInitialized()) {
    console.log('[AI Service] Attempting analysis with OpenRouter (primary)');
    notifyProviderSelection('OpenRouter');

    try {
      return await withRetry(
        () => openRouterProvider.analyze(processes, prompt),
        {
          maxRetries: 3,
          onRetry: (attempt) => notifyRetry('OpenRouter', attempt, 3)
        }
      );
    } catch (error) {
      openRouterError = error;
      console.warn(`[AI Service] OpenRouter failed: ${getErrorMessage(error)}. Fallback to Gemini.`);
    }
  }

  // 2. Fallback to Gemini
  console.log('[AI Service] Attempting analysis with Gemini');
  notifyProviderSelection('Gemini (Fallback)');

  try {
    return await withRetry(
      () => geminiProvider.analyze(processes, prompt),
      {
        maxRetries: 3,
        onRetry: (attempt) => notifyRetry('Gemini', attempt, 3)
      }
    );
  } catch (geminiError) {
     const combinedError = new Error(
      `Both AI providers failed. OpenRouter: ${openRouterError ? getErrorMessage(openRouterError) : 'Skipped/Not Configured'}. Gemini: ${getErrorMessage(geminiError)}`
    );
    throw combinedError;
  }
}

/**
 * Helper to save multiple analysis results
 */
function saveBatchAnalysis(results: AnalysisResult[]) {
  results.forEach(result => {
    try {
      saveAnalysis(result);
    } catch (error) {
      console.error(`[AI Service] Failed to save analysis for ${result.process_name}:`, error);
    }
  });
}

// --- logging helpers ---

function logToUI(type: 'info' | 'error', message: string) {
  if (webContents && !webContents.isDestroyed()) {
    webContents.send('batch-analysis-log', { type, message });
  }
}

function notifyProviderSelection(provider: string) {
  if (webContents && !webContents.isDestroyed()) {
    webContents.send('ai-provider-selected', { provider });
  }
}

function notifyRetry(provider: string, attempt: number, maxRetries: number) {
  console.log(`[AI Service] ${provider} retry attempt ${attempt}/${maxRetries}...`);
  if (webContents && !webContents.isDestroyed()) {
    webContents.send('batch-analysis-retry', { provider, attempt, maxRetries });
  }
}

export function isAnalyzing(): boolean {
  return isProcessing;
}

// Re-export buildOptimizedPrompt if it was consumed externally
export { buildOptimizedPrompt };

// ===== DEV MODE ANALYSIS =====

/**
 * Analyze processes in Dev Mode for advanced memory profiling
 * Uses dual-metric analysis (PWS + WS) to detect leaks and inefficiencies
 */
export async function analyzeDevModeBatch(processes: ProcessInfo[]): Promise<DevModeAnalysisResult[]> {
  if (!geminiProvider.isInitialized()) {
    throw new Error('Gemini API not initialized. Please set API key first.');
  }

  if (isProcessing) {
    throw new Error('Batch analysis already in progress');
  }

  if (processes.length === 0) {
    return [];
  }

  // Deduplicate processes by name
  const uniqueProcesses = deduplicateProcesses(processes);
  const duplicateInstances = processes.length - uniqueProcesses.length;
  
  if (duplicateInstances > 0) {
    const message = `[Dev Mode] Deduplication: ${processes.length} → ${uniqueProcesses.length} unique processes`;
    console.log(`[AI Service] ${message}`);
    logToUI('info', message);
  }

  if (uniqueProcesses.length === 0) {
    return [];
  }

  isProcessing = true;

  try {
    const chunks = createProcessBatches(uniqueProcesses);
    
    if (chunks.length > 1) {
      const message = `[Dev Mode] Split ${uniqueProcesses.length} processes into ${chunks.length} batches`;
      console.log(`[AI Service] ${message}`);
      logToUI('info', message);
    }

    const allResults: DevModeAnalysisResult[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const message = `[Dev Mode] Processing batch ${i + 1}/${chunks.length} (${chunk.length} processes)...`;
      console.log(`[AI Service] ${message}`);
      logToUI('info', message);
      
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('batch-analysis-progress', {
          currentBatch: i + 1,
          totalBatches: chunks.length,
          processesInBatch: chunk.length
        });
      }

      const results = await analyzeDevModeChunk(chunk);
      allResults.push(...results);
      
      // Save results immediately
      saveDevModeBatchAnalysis(results);
      console.log(`[AI Service] Saved ${results.length} Dev Mode analysis results to database`);
    }

    if (webContents && !webContents.isDestroyed()) {
      webContents.send('batch-analysis-complete', {
        count: allResults.length,
        timestamp: new Date().toISOString()
      });
    }

    return allResults;

  } catch (error) {
    console.error('[AI Service] Dev Mode batch analysis failed:', error);
    throw error;
  } finally {
    isProcessing = false;
  }
}

/**
 * Analyze a single chunk in Dev Mode with provider fallback
 */
async function analyzeDevModeChunk(processes: ProcessInfo[]): Promise<DevModeAnalysisResult[]> {
  const prompt = buildDevModePrompt(processes);
  let openRouterError: any = null;

  // Try OpenRouter first
  if (openRouterProvider.isInitialized()) {
    console.log('[AI Service] [Dev Mode] Attempting analysis with OpenRouter');
    notifyProviderSelection('OpenRouter (Dev Mode)');

    try {
      return await withRetry(
        () => analyzeDevModeWithProvider(openRouterProvider, prompt),
        {
          maxRetries: 3,
          onRetry: (attempt) => notifyRetry('OpenRouter', attempt, 3)
        }
      );
    } catch (error) {
      openRouterError = error;
      console.warn(`[AI Service] [Dev Mode] OpenRouter failed: ${getErrorMessage(error)}. Fallback to Gemini.`);
    }
  }

  // Fallback to Gemini
  console.log('[AI Service] [Dev Mode] Attempting analysis with Gemini');
  notifyProviderSelection('Gemini (Dev Mode Fallback)');

  try {
    return await withRetry(
      () => analyzeDevModeWithProvider(geminiProvider, prompt),
      {
        maxRetries: 3,
        onRetry: (attempt) => notifyRetry('Gemini', attempt, 3)
      }
    );
  } catch (geminiError) {
    const combinedError = new Error(
      `Both AI providers failed in Dev Mode. OpenRouter: ${openRouterError ? getErrorMessage(openRouterError) : 'Skipped'}. Gemini: ${getErrorMessage(geminiError)}`
    );
    throw combinedError;
  }
}

/**
 * Generic Dev Mode analysis with any provider
 */
async function analyzeDevModeWithProvider(provider: any, prompt: string): Promise<DevModeAnalysisResult[]> {
  const model = provider.genAI ? provider.genAI.getGenerativeModel({ model: provider.modelName || 'gemini-2.5-flash' }) : null;
  
  if (!model) {
    // OpenRouter path - use getRawCompletion for Dev Mode (different JSON format)
    const text = await provider.getRawCompletion(prompt);
    return parseDevModeResponse(text);
  }
  
  // Gemini path
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  return parseDevModeResponse(text);
}

/**
 * Parse Dev Mode JSON response
 */
function parseDevModeResponse(text: string): DevModeAnalysisResult[] {
  let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  const arrayStart = jsonStr.indexOf('[');
  const arrayEnd = jsonStr.lastIndexOf(']');
  
  if (arrayStart === -1 || arrayEnd === -1 || arrayStart >= arrayEnd) {
    throw new Error('No valid JSON array found in Dev Mode response');
  }
  
  jsonStr = jsonStr.substring(arrayStart, arrayEnd + 1);
  
  try {
    const data = JSON.parse(jsonStr) as Array<{
      n: string;
      type: 'Leak' | 'Inefficient' | 'Normal' | 'Suspicious';
      analysis: string;
      recommendation: string;
    }>;

    return data.map(item => ({
      process_name: item.n,
      type: item.type,
      analysis: item.analysis,
      recommendation: item.recommendation
    }));
  } catch (e) {
    console.error('Failed to parse Dev Mode response:', jsonStr);
    throw new Error('Failed to parse JSON response from Dev Mode analysis');
  }
}

/**
 * Save Dev Mode batch results
 */
function saveDevModeBatchAnalysis(results: DevModeAnalysisResult[]) {
  results.forEach(result => {
    try {
      saveDevModeAnalysis(result);
    } catch (error) {
      console.error(`[AI Service] Failed to save Dev Mode analysis for ${result.process_name}:`, error);
    }
  });
}
