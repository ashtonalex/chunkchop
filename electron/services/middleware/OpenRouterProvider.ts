import { AIProvider } from './AIProvider.js';
import { ProcessInfo } from '../../utils/ProcessUtils.js';
import { AnalysisResult } from '../Database.js';

export class OpenRouterProvider implements AIProvider {
  name = 'OpenRouter';
  private apiKey: string | null = null;
  private modelName = 'google/gemini-2.0-flash-001'; // Defaulting to a reliable model, user can change
  // Note: Previous context mentioned gpt-oss-20b, but using a generally available one or making it configurable is safer.
  // I will stick to what the user likely had or a safe default. Let's use a standard one. 
  // actually, let's look at the summary "Integrate OpenRouter Fallback ... integrate gpt-oss-20b". 
  // So I should probably use 'gpt-oss-20b' equivalent or 'meta-llama/llama-3-8b-instruct:free' or similar if that's what they wanted.
  // Better yet, I'll allow it to be set.
  
  constructor(apiKey?: string, model?: string) {
    if (apiKey) {
      this.initialize(apiKey);
    }
    if (model) {
      this.modelName = model;
    }
  }

  initialize(apiKey: string) {
    this.apiKey = apiKey;
  }

  isInitialized(): boolean {
    return this.apiKey !== null;
  }

  async analyze(_processes: ProcessInfo[], prompt: string): Promise<AnalysisResult[]> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not set');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/chunkchop/react-ts', // Application URL
        'X-Title': 'ChunkChop Process Analyzer', // Application name
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API refused: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter');
    }

    const text = data.choices[0].message.content;
    return this.parseResponse(text);
  }

  private parseResponse(text: string): AnalysisResult[] {
    // Reuse similar parsing logic - could be extracted to a shared parser if identical
    // But keeping it here since prompts might slighty differ in output format quirks per model
    
    let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const arrayStart = jsonStr.indexOf('[');
    const arrayEnd = jsonStr.lastIndexOf(']');
    
    if (arrayStart === -1 || arrayEnd === -1 || arrayStart >= arrayEnd) {
      throw new Error('No valid JSON array found in response');
    }
    
    jsonStr = jsonStr.substring(arrayStart, arrayEnd + 1);
    
    try {
      const data = JSON.parse(jsonStr) as Array<{
        n: string;
        r: 'Safe' | 'Bloat' | 'Unknown' | 'Critical';
        d: string;
        k: boolean;
      }>;

      return data.map(item => ({
        process_name: item.n,
        risk_level: item.r,
        description: item.d,
        recommendation: item.k ? 'Keep - Required for system' : 'Safe to terminate'
      }));
    } catch (e) {
      console.error('Failed to parse OpenRouter response:', jsonStr);
      throw new Error('Failed to parse JSON response from OpenRouter');
    }
  }
}
