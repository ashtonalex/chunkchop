import { AIProvider } from './AIProvider.js';
import { ProcessInfo } from '../../utils/ProcessUtils.js';
import { AnalysisResult } from '../Database.js';

export class OpenRouterProvider implements AIProvider {
  name = 'OpenRouter';
  private apiKey: string | null = null;
  private modelName = 'gpt-oss-20b';
  private modelParams: Record<string, any> = {};
  
  constructor(apiKey?: string, model?: string, modelParams?: Record<string, any>) {
    if (apiKey) {
      this.initialize(apiKey);
    }
    if (model) {
      this.modelName = model;
    }
    if (modelParams) {
      this.modelParams = modelParams;
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
        // Add model-specific parameters (e.g., { 'reasoning_effort': 'high' })
        ...this.modelParams,
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

  /**
   * Get raw completion text from OpenRouter (for Dev Mode parsing)
   */
  async getRawCompletion(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not set');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/chunkchop/react-ts',
        'X-Title': 'ChunkChop Process Analyzer',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelName,
        ...this.modelParams,
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

    return data.choices[0].message.content;
  }

  private parseResponse(text: string): AnalysisResult[] {
    
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
