export interface Analysis {
  risk_level: string;
  [key: string]: any;
}

export interface Process {
  pid: number;
  name: string;
  cpu: number;
  mem: number; // RSS/Working Set in bytes
  memVirtual?: number; // Virtual memory in bytes (optional)
  analysis?: Analysis;
}

export interface FilterOptions {
  searchTerm: string;
  riskFilter: string;
  minCpu: number;
  minMem: number;
}
