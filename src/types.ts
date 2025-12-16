export interface Analysis {
  risk_level: string;
  [key: string]: any;
}

export interface DevModeAnalysis {
  type: 'Leak' | 'Inefficient' | 'Normal' | 'Suspicious';
  analysis: string;
  recommendation: string;
}

export interface Process {
  pid: number;
  name: string;
  cpu: number;
  mem: number; // RSS/Working Set in bytes
  memVirtual?: number; // Virtual memory in bytes (optional)
  privateMemory?: number; // Private Working Set in MB (from PowerShell)
  memRss?: number; // Total Working Set in bytes (for Dev Mode calculations)
  analysis?: Analysis;
}

export interface FilterOptions {
  searchTerm: string;
  riskFilter: string;
  minCpu: number;
  minMem: number;
}
