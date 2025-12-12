import { spawn, ChildProcess } from 'child_process';

export interface PrivateMemoryStats {
  Id: number;
  PrivateMemorySize64: number;
}

/**
 * PowerShellService manages a persistent PowerShell process to fetch
 * Private Working Set memory metrics for all processes.
 * This is more accurate than systeminformation's memRss on Windows.
 */
export class PowerShellService {
  private process: ChildProcess | null = null;
  private isRestarting = false;
  private responseBuffer = '';

  constructor() {
    this.init();
  }

  /**
   * Initialize the PowerShell process
   */
  private init(): void {
    try {
      console.log('[PowerShellService] Spawning PowerShell process...');
      
      // Spawn PowerShell with -NoProfile for faster startup, -Command - for interactive mode
      this.process = spawn('powershell.exe', ['-NoProfile', '-Command', '-'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true, // Hide PowerShell window
      });

      // Handle stdout data
      this.process.stdout?.on('data', (data: Buffer) => {
        this.responseBuffer += data.toString();
      });

      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        console.error('[PowerShellService] Error:', data.toString());
      });

      // Handle process exit
      this.process.on('exit', (code) => {
        console.warn(`[PowerShellService] PowerShell process exited with code ${code}`);
        this.process = null;
        
        // Auto-restart if not already restarting
        if (!this.isRestarting) {
          this.restart();
        }
      });

      // Handle process error
      this.process.on('error', (error) => {
        console.error('[PowerShellService] Process error:', error);
        this.process = null;
        
        if (!this.isRestarting) {
          this.restart();
        }
      });

      console.log('[PowerShellService] PowerShell process initialized successfully');
    } catch (error) {
      console.error('[PowerShellService] Failed to initialize:', error);
      this.restart();
    }
  }

  /**
   * Restart the PowerShell process after a delay
   */
  private restart(): void {
    if (this.isRestarting) return;
    
    this.isRestarting = true;
    console.log('[PowerShellService] Restarting PowerShell in 2 seconds...');
    
    setTimeout(() => {
      this.isRestarting = false;
      this.init();
    }, 2000);
  }

  /**
   * Get Private Memory statistics for all processes
   * Returns an array of { Id: PID, PrivateMemorySize64: bytes }
   */
  async getPrivateMemoryStats(): Promise<PrivateMemoryStats[]> {
    if (!this.process || !this.process.stdin) {
      console.warn('[PowerShellService] PowerShell process not available, returning empty results');
      return [];
    }

    try {
      // Clear the buffer before sending command
      this.responseBuffer = '';

      // PowerShell command to get Process ID and Private Memory Size
      // Using -Compress to reduce whitespace and make parsing easier
      const command = 'Get-Process | Select-Object Id, PrivateMemorySize64 | ConvertTo-Json -Compress\n';
      
      // Write command to stdin
      this.process.stdin.write(command);

      // Wait for response with timeout
      const response = await this.waitForResponse(5000);
      
      // Parse JSON response
      const data = JSON.parse(response);
      
      // Handle both single object and array responses
      const results: PrivateMemoryStats[] = Array.isArray(data) ? data : [data];
      
      // Filter out invalid entries (sometimes Get-Process returns processes without memory info)
      return results.filter(item => 
        item && 
        typeof item.Id === 'number' && 
        typeof item.PrivateMemorySize64 === 'number'
      );
      
    } catch (error) {
      console.error('[PowerShellService] Failed to get private memory stats:', error);
      return [];
    }
  }

  /**
   * Wait for PowerShell response with timeout
   */
  private waitForResponse(timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        // Check if we have a complete JSON response
        // Look for array end ] or object end } followed by newline
        const hasCompleteJson = this.responseBuffer.match(/[\]\}]\s*$/);
        
        if (hasCompleteJson) {
          clearInterval(checkInterval);
          const response = this.responseBuffer.trim();
          this.responseBuffer = ''; // Clear buffer for next command
          resolve(response);
          return;
        }
        
        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error('Timeout waiting for PowerShell response'));
        }
      }, 50); // Check every 50ms
    });
  }

  /**
   * Cleanup the PowerShell process
   */
  cleanup(): void {
    console.log('[PowerShellService] Cleaning up PowerShell process...');
    
    if (this.process) {
      this.isRestarting = true; // Prevent auto-restart
      this.process.kill();
      this.process = null;
    }
  }
}
