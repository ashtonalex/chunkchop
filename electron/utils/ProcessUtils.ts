
export interface ProcessInfo {
  name: string;
  cpu: number;
  mem: number; // Private Working Set in MB (from PowerShell)
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
  // Create CSV data (name, cpu%, privateMemoryMB)
  const csvData = processes.map(p => `${p.name},${p.cpu.toFixed(1)},${p.mem.toFixed(0)}`).join('\n');

  return `Act as a Senior Windows System Administrator and Security Analyst. Analyze the following list of active processes to identify performance bottlenecks, bloatware, and security risks.

Input Format: "Process Name, CPU Usage (%), Private Memory (MB)"

**Definitions:**
- **Private Memory:** The specific RAM unique to this process. High private memory in background tasks often indicates memory leaks or inefficient bloatware.

Instructions:
1. Identify the specific application or vendor.
2. **MANDATORY 'KEEP' (k) RULE:**
   - You MUST set "k":true for ALL Windows Kernel & System processes, including but not limited to: System, Registry, smss.exe, csrss.exe, wininit.exe, services.exe, lsass.exe, svchost.exe, winlogon.exe, dwm.exe, spoolsv.exe, explorer.exe, taskhostw.exe, conhost.exe, sihost.exe, fontdrvhost.exe, Memory Compression.
   - You MUST set "k":true for active user applications (Browsers, Games, IDEs, Media Players) unless they are frozen/responsive.
   - Set "k":false ONLY for: Bloatware, background updaters, telemetry agents, malware, and non-essential utilities.

3. Assess Risk Category (r):
   - **SystemCritical:** ESSENTIAL Windows kernel & OS processes that MUST NEVER be terminated (System, Registry, smss.exe, csrss.exe, wininit.exe, services.exe, lsass.exe, svchost.exe, winlogon.exe, dwm.exe, fontdrvhost.exe, Memory Compression, any process with PID 0 or 4). These are core OS components - terminating them will crash Windows.
   - **Safe:** Standard user applications (Chrome, Discord, Steam, VS Code, Antigravity) and non-critical Windows utilities. Safe to terminate if needed.
   - **Bloat:** Pre-installed OEM junk, unnecessary updaters (e.g., Adobe Update Service), telemetry agents. **FLAG AS BLOAT** if a background service is consuming excessive Private Memory (>150MB) without active user interaction.
   - **Critical:** SECURITY THREATS - malware, miners, trojans, ransomware, or suspicious masquerading processes. These should be terminated immediately.
   - **Unknown:** Unverified process names that cannot be confidently categorized.

4. **Resource Analysis:**
   - Use the **Private Memory** value to determine efficiency. If a simple background utility uses high Private Memory (>100MB), flag it in the description as "Inefficient resource usage".

Return ONLY a JSON array. No markdown.

Format: [{"n":"process_name.exe","r":"SystemCritical|Safe|Bloat|Critical|Unknown","d":"description <400 chars","k":true|false}]
- n: Exact process name.
- r: Risk Category (MUST use SystemCritical for essential Windows kernel processes).
- d: Contextual description. For SystemCritical processes, ALWAYS state "Essential Windows System Process - DO NOT TERMINATE".
- k: Keep status. true = DO NOT KILL, false = KILL.

Process data:
${csvData}

Return JSON array only:`;
}

