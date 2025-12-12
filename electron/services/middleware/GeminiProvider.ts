import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider } from './AIProvider.js';
import { ProcessInfo } from '../../utils/ProcessUtils.js';
import { AnalysisResult } from '../Database.js';

export class GeminiProvider implements AIProvider {
  name = 'Gemini';
  private genAI: GoogleGenerativeAI | null = null;
  private modelName = 'gemini-2.5-flash';

  constructor(apiKey?: string) {
    if (apiKey) {
      this.initialize(apiKey);
    }
  }

  initialize(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  isInitialized(): boolean {
    return this.genAI !== null;
  }

  async analyze(_processes: ProcessInfo[], prompt: string): Promise<AnalysisResult[]> {
    if (!this.genAI) {
      throw new Error('Gemini API not initialized');
    }

    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return this.parseResponse(text);
  }

  private parseResponse(text: string): AnalysisResult[] {
    // Clean markdown code blocks if any
    let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Extract only the JSON array portion
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
      console.error('Failed to parse Gemini response:', jsonStr);
      throw new Error('Failed to parse JSON response from Gemini');
    }
  }
}
