import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveAnalysis, AnalysisResult } from './Database.js';
import { initOpenRouter, analyzeWithOpenRouter, isOpenRouterRetryableError } from './OpenRouterService.js';

let genAI: GoogleGenerativeAI | null = null;
let webContents: any = null;
let isProcessing = false;

export interface ProcessInfo {
  name: string;
  cpu: number;
  mem: number;
}

export function initGemini(apiKey: string, wc: any) {
  if (!apiKey) return;
  genAI = new GoogleGenerativeAI(apiKey);
  webContents = wc;
}

export { initOpenRouter };

/**
 * Analyze a batch of processes in a single API call with automatic retry
 * @param processes Array of process info to analyze
 * @returns Promise that resolves when batch analysis is complete
 */
export async function analyzeProcessesBatch(processes: ProcessInfo[]): Promise<AnalysisResult[]> {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please set API key first.');
  }

  if (isProcessing) {
    throw new Error('Batch analysis already in progress');
  }

  if (processes.length === 0) {
    return [];
  }

  // Deduplicate processes by name to reduce token usage
  // Note: This removes multiple instances of the same process name (e.g., multiple chrome.exe instances)
  // since analysis is stored by process name, not by PID
  const uniqueProcesses = deduplicateProcesses(processes);
  const duplicateInstances = processes.length - uniqueProcesses.length;
  
  if (duplicateInstances > 0) {
    const message = `Deduplication: ${processes.length} unanalyzed process instances → ${uniqueProcesses.length} unique process names (removed ${duplicateInstances} duplicate instances)`;
    console.log(`[AI Service] ${message}`);
    
    if (webContents && !webContents.isDestroyed()) {
      webContents.send('batch-analysis-log', {
        type: 'info',
        message: message
      });
    }
  } else {
    console.log(`[AI Service] All ${uniqueProcesses.length} unanalyzed processes have unique names, no deduplication needed`);
  }

  if (uniqueProcesses.length === 0) {
    return [];
  }

  isProcessing = true;

  try {
    // Split into chunks of max 60 processes to avoid output token limits
    const BATCH_SIZE = 60;
    const chunks = chunkArray(uniqueProcesses, BATCH_SIZE);
    
    if (chunks.length > 1) {
      const message = `Split ${uniqueProcesses.length} processes into ${chunks.length} batches of max ${BATCH_SIZE} processes`;
      console.log(`[AI Service] ${message}`);
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('batch-analysis-log', { type: 'info', message });
      }
    }

    const allResults: AnalysisResult[] = [];

    // Process each chunk sequentially
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const message = `Processing batch ${i + 1}/${chunks.length} (${chunk.length} processes)...`;
      console.log(`[AI Service] ${message}`);
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('batch-analysis-log', { type: 'info', message });
      }
      
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
 * Analyze a single chunk of processes with retry logic
 * @param processes Array of process info to analyze (max 60)
 * @returns Promise that resolves with analysis results
 */
async function analyzeProcessChunk(processes: ProcessInfo[]): Promise<AnalysisResult[]> {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000; // 1 second
  const prompt = buildOptimizedPrompt(processes);

  // Try OpenRouter first
  console.log('[AI Service] Attempting analysis with OpenRouter (primary)');
  
  // Notify UI that we're using OpenRouter
  if (webContents && !webContents.isDestroyed()) {
    webContents.send('ai-provider-selected', { provider: 'OpenRouter' });
  }

  let openRouterError: any = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[AI Service] OpenRouter retry attempt ${attempt}/${MAX_RETRIES}...`);
        
        if (webContents && !webContents.isDestroyed()) {
          webContents.send('batch-analysis-retry', {
            provider: 'OpenRouter',
            attempt,
            maxRetries: MAX_RETRIES
          });
        }
      }

      const results = await analyzeWithOpenRouter(processes, prompt);
      console.log(`[AI Service] OpenRouter analysis successful`);
      return results;

    } catch (error: any) {
      openRouterError = error;
      const isRetryable = isOpenRouterRetryableError(error);
      const isLastAttempt = attempt === MAX_RETRIES;

      if (!isRetryable || isLastAttempt) {
        console.warn(`[AI Service] OpenRouter ${isRetryable ? 'failed after max retries' : 'encountered non-retryable error'}: ${getErrorMessage(error)}`);
        break; // Exit retry loop and try Gemini fallback
      }

      const delay = BASE_DELAY * Math.pow(3, attempt);
      console.warn(`[AI Service] OpenRouter retryable error (${getErrorMessage(error)}). Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // OpenRouter failed, try Gemini as fallback
  console.log('[AI Service] Falling back to Gemini API');
  
  if (webContents && !webContents.isDestroyed()) {
    webContents.send('ai-provider-selected', { provider: 'Gemini (Fallback)' });
  }

  if (!genAI) {
    const combinedError = new Error(
      `Both OpenRouter and Gemini failed. OpenRouter: ${getErrorMessage(openRouterError)}. Gemini: Not initialized.`
    );
    console.error('[AI Service]', combinedError.message);
    throw combinedError;
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  let geminiError: any = null;

  // Retry loop with exponential backoff for Gemini
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[AI Service] Gemini retry attempt ${attempt}/${MAX_RETRIES}...`);
        
        if (webContents && !webContents.isDestroyed()) {
          webContents.send('batch-analysis-retry', {
            provider: 'Gemini',
            attempt,
            maxRetries: MAX_RETRIES
          });
        }
      }

      const startTime = Date.now();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const elapsed = Date.now() - startTime;
      console.log(`[AI Service] Gemini analysis completed in ${elapsed}ms`);

      // Clean markdown code blocks if any
      let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Extract only the JSON array portion (handles extra text before/after)
      const arrayStart = jsonStr.indexOf('[');
      const arrayEnd = jsonStr.lastIndexOf(']');
      
      if (arrayStart === -1 || arrayEnd === -1 || arrayStart >= arrayEnd) {
        throw new Error('No valid JSON array found in response');
      }
      
      jsonStr = jsonStr.substring(arrayStart, arrayEnd + 1);
      
      const data = JSON.parse(jsonStr) as Array<{
        n: string;
        r: 'Safe' | 'Bloat' | 'Unknown' | 'Critical';
        d: string;
        k: boolean;
      }>;

      // Transform abbreviated format to full AnalysisResult
      const results: AnalysisResult[] = data.map(item => ({
        process_name: item.n,
        risk_level: item.r,
        description: item.d,
        recommendation: item.k ? 'Keep - Required for system' : 'Safe to terminate'
      }));

      // Save all results in batch
      saveBatchAnalysis(results);
      console.log(`[AI Service] Saved ${results.length} analysis results to database`);
      
      return results;

    } catch (error: any) {
      geminiError = error;
      const isRetryable = isRetryableError(error);
      const isLastAttempt = attempt === MAX_RETRIES;

      if (!isRetryable || isLastAttempt) {
        console.error(`[AI Service] Gemini ${isRetryable ? 'max retries exceeded' : 'non-retryable error'}:`, error);
        break;
      }

      const delay = BASE_DELAY * Math.pow(3, attempt);
      console.warn(`[AI Service] Gemini retryable error (${getErrorMessage(error)}). Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // Both services failed
  const combinedError = new Error(
    `Both AI providers failed. OpenRouter: ${getErrorMessage(openRouterError)}. Gemini: ${getErrorMessage(geminiError)}`
  );
  console.error('[AI Service]', combinedError.message);
  throw combinedError;
}

/**
 * Build an optimized prompt with minimal token usage
 * Uses CSV format and abbreviated JSON keys to reduce cost
 * Exported to be shared with OpenRouterService
 */
export function buildOptimizedPrompt(processes: ProcessInfo[]): string {
  // Create CSV data (name,cpu%,memMB)
  const csvData = processes.map(p => `${p.name},${p.cpu.toFixed(1)},${p.mem.toFixed(0)}`).join('\n');

  return `Act as a Senior Windows System Administrator and Security Analyst. Analyze the following list of active processes to identify performance bottlenecks, bloatware, and security risks.

Input Format: "Process Name, CPU Usage (%), Memory Usage (MB)"

Instructions:
1. Identify the specific application or vendor associated with each executable.
2. Assess Risk Category carefully:
   - Safe: Normal user applications, browsers, games, productivity tools, AND essential Windows OS processes (e.g., System, Registry, csrss.exe, winlogon.exe, lsass.exe, smss.exe, services.exe, wininit.exe, dwm.exe, conhost.exe, sihost.exe, taskhostw.exe). Use "k":true for essential OS processes to lock them.
   - Bloat: Unnecessary telemetry, updaters, pre-installed junk, background services. Recommended to terminate.
   - Critical: SECURITY THREATS - malware, miners, suspicious processes, masqueraders. MUST be terminable by user! Use "k":false for these.
   - Unknown: Unverified or unclear processes. Investigate further.
3. Determine "Keep" status: Set 'true' ONLY for essential OS processes (PID 0, 4, or critical system processes) and active user applications. Set 'false' for bloat, updaters, telemetry, and security threats.
4. If CPU/Memory usage is abnormally high, mention this in the description.

Return ONLY a JSON array containing the analysis. No markdown, no preambles.

Format: [{"n":"process_name.exe","r":"Safe|Bloat|Unknown|Critical","d":"Specific description & context (<200 chars)","k":true|false}]
- n: Exact process name from input.
- r: Risk Category (see above). Use Safe for both user apps and essential OS processes. Use Critical ONLY for security threats.
- d: Contextual description. Identify vendor/purpose. For essential OS processes, mention "Essential Windows system process". Mention if resource usage is suspicious. Max 200 chars.
- k: Keep? true (Essential OS processes/Active User Apps) vs false (Bloat/Updaters/Security Threats).

CRITICAL: Essential OS processes should be marked as "r":"Safe" with "k":true. Security threats should be marked as "r":"Critical" with "k":false.

Process data:
${csvData}

Return JSON array only:`;
}

/**
 * Deduplicate processes by name (case-insensitive)
 * Returns array of unique processes, keeping the first occurrence of each
 */
function deduplicateProcesses(processes: ProcessInfo[]): ProcessInfo[] {
  const seen = new Map<string, ProcessInfo>();
  
  for (const process of processes) {
    const normalizedName = process.name.toLowerCase();
    if (!seen.has(normalizedName)) {
      seen.set(normalizedName, process);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Save multiple analysis results efficiently using a transaction
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

/**
 * Split an array into chunks of specified size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (transient errors like rate limits or service unavailable)
 */
function isRetryableError(error: any): boolean {
  const errorMessage = getErrorMessage(error);
  
  // Check for specific retryable HTTP status codes
  if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
    return true; // Service temporarily unavailable
  }
  
  if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
    return true; // Rate limit exceeded
  }
  
  if (errorMessage.includes('overloaded')) {
    return true; // Model overloaded
  }
  
  // Network errors that might be transient
  if (errorMessage.includes('ECONNRESET') || 
      errorMessage.includes('ETIMEDOUT') || 
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('fetch failed')) {
    return true;
  }
  
  return false;
}

/**
 * Extract a readable error message from various error types
 */
function getErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.toString) {
    return error.toString();
  }
  
  return 'Unknown error';
}

export function isAnalyzing(): boolean {
  return isProcessing;
}
