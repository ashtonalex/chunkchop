import { AnalysisResult } from '../Database.js';
import { ProcessInfo } from '../../utils/ProcessUtils.js';

export interface AIProvider {
  name: string;
  analyze(processes: ProcessInfo[], prompt: string): Promise<AnalysisResult[]>;
}
