
export interface ProcessInfo {
  name: string;
  cpu: number;
  mem: number;
}


/**
 * Deduplicate processes by name (case-insensitive)
 * Returns array of unique processes, keeping the first occurrence of each
 */
export function deduplicateProcesses(processes: ProcessInfo[]): ProcessInfo[] {
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
 * Split an array into chunks of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}


/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build an optimized prompt with minimal token usage
 * Uses CSV format and abbreviated JSON keys to reduce cost
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

