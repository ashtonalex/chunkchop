import { OpenRouter } from "@openrouter/sdk";
import { saveAnalysis, AnalysisResult } from './Database.js';

let openRouter: OpenRouter | null = null;
let webContents: any = null;

export interface ProcessInfo {
  name: string;
  cpu: number;
  mem: number;
}

export function initOpenRouter(apiKey: string, wc: any) {
  if (!apiKey) return;
  openRouter = new OpenRouter({
    apiKey: apiKey
  });
  webContents = wc;
}

/**
 * Analyze processes using OpenRouter API with streaming
 * @param processes Array of process info to analyze (max 60 recommended)
 * @param systemPrompt The system prompt to use for analysis
 * @returns Promise that resolves with analysis results
 */
export async function analyzeWithOpenRouter(
  processes: ProcessInfo[], 
  systemPrompt: string
): Promise<AnalysisResult[]> {
  if (!openRouter) {
    throw new Error('OpenRouter API not initialized. Please set API key first.');
  }

  if (processes.length === 0) {
    return [];
  }

  try {
    const startTime = Date.now();
    console.log(`[OpenRouter Service] Starting analysis for ${processes.length} processes...`);

    // Stream the response to get reasoning tokens in usage
    const stream = await openRouter.chat.send({
      model: "openai/gpt-oss-20b:free",
      messages: [
        {
          role: "user",
          content: systemPrompt
        }
      ],
      stream: true,
      streamOptions: {
        includeUsage: true
      }
    });

    let response = "";
    let reasoningTokens = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        response += content;
      }
      
      // Usage information comes in the final chunk
      if (chunk.usage) {
        reasoningTokens = (chunk.usage as any).reasoningTokens || 0;
        console.log(`[OpenRouter Service] Reasoning tokens: ${reasoningTokens}`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[OpenRouter Service] Analysis completed in ${elapsed}ms`);

    // Clean markdown code blocks if any
    const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
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

    // Save all results
    results.forEach(result => {
      try {
        saveAnalysis(result);
      } catch (error) {
        console.error(`[OpenRouter Service] Failed to save analysis for ${result.process_name}:`, error);
      }
    });

    console.log(`[OpenRouter Service] Saved ${results.length} analysis results to database`);
    return results;

  } catch (error: any) {
    console.error('[OpenRouter Service] Analysis failed:', error);
    throw error;
  }
}

/**
 * Check if an error from OpenRouter is retryable
 */
export function isOpenRouterRetryableError(error: any): boolean {
  const errorMessage = getErrorMessage(error);
  
  // Check for specific retryable HTTP status codes
  if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
    return true;
  }
  
  if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
    return true;
  }
  
  if (errorMessage.includes('overloaded')) {
    return true;
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
