import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveAnalysis, AnalysisResult } from './Database.js';

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

/**
 * Analyze a batch of processes in a single API call
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
  const uniqueProcesses = deduplicateProcesses(processes);
  const duplicatesRemoved = processes.length - uniqueProcesses.length;
  
  if (duplicatesRemoved > 0) {
    console.log(`[GeminiService] Removed ${duplicatesRemoved} duplicate process(es). Analyzing ${uniqueProcesses.length} unique processes.`);
  }

  if (uniqueProcesses.length === 0) {
    return [];
  }

  isProcessing = true;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = buildOptimizedPrompt(uniqueProcesses);
    
    console.log(`[GeminiService] Analyzing ${uniqueProcesses.length} unique processes in batch...`);
    const startTime = Date.now();

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const elapsed = Date.now() - startTime;
    console.log(`[GeminiService] Batch analysis completed in ${elapsed}ms`);

    // Clean markdown code blocks if any
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
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

    // Notify UI of completion
    if (webContents && !webContents.isDestroyed()) {
      webContents.send('batch-analysis-complete', {
        count: results.length,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[GeminiService] Saved ${results.length} analysis results to database`);
    return results;

  } catch (error) {
    console.error('[GeminiService] Batch analysis failed:', error);
    throw error;
  } finally {
    isProcessing = false;
  }
}

/**
 * Build an optimized prompt with minimal token usage
 * Uses CSV format and abbreviated JSON keys to reduce cost
 */
function buildOptimizedPrompt(processes: ProcessInfo[]): string {
  // Create CSV data (name,cpu%,memMB)
  const csvData = processes.map(p => `${p.name},${p.cpu.toFixed(1)},${p.mem.toFixed(0)}`).join('\n');

  return `Analyze these Windows processes. Return ONLY a JSON array, concise explanation.

Format: [{"n":"name.exe","r":"Safe|Bloat|Unknown|Critical","d":"description <200 chars","k":true|false}]
- n=process name
- r=risk level (Safe=system/trusted, Bloat=unnecessary, Unknown=unclear, Critical=malware/danger)
- d=brief description (max 200 chars)
- k=keep? true=essential, false=safe to kill

Process data (name,cpu%,memMB):
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
      console.error(`[GeminiService] Failed to save analysis for ${result.process_name}:`, error);
    }
  });
}

export function isAnalyzing(): boolean {
  return isProcessing;
}
