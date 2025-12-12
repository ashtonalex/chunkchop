import React from 'react';

interface Process {
  pid: number;
  name: string;
  cpu: number;
  mem: number; // RSS/Working Set in bytes
  memVirtual?: number; // Virtual memory in bytes
  command?: string;
  user?: string;
  analysis?: {
    risk_level: string;
    description: string;
    recommendation: string; // "Terminate", "Keep", "Investigate" etc.
  };
}

interface Props {
  process: Process | null;
  onTrack: (pid: number) => void;
}

const InspectorPane: React.FC<Props> = ({ process, onTrack }) => {
  if (!process) {
    return (
      <div className="h-64 bg-tech-black border-t border-tech-gray p-6 flex items-center justify-center">
        <div className="text-center">
            <div className="text-neon-blue/50 text-4xl mb-2 font-thin animate-pulse">NO SIGNAL</div>
            <div className="text-text-dim text-sm font-mono">Select a process stream to analyze telemetry</div>
        </div>
      </div>
    );
  }

  // Lock only SYSTEM-critical processes (essential OS), NOT security threats
  // SystemCritical = essential OS processes (PID 0, 4, System, csrss.exe, etc.)
  // Critical = security threats (malware, miners) - these should NOT be locked!
  const isCritical = process.pid === 0 || process.pid === 4 || process.analysis?.risk_level === 'SystemCritical';

  // Determine Recommendation Colors and Text
  let recColor = 'text-gray-500';
  let recText = 'ANALYZING...';
  let safeToTerminate = null; // null = n/a, true = YES, false = NO

  if (process.analysis) {
      if (isCritical) {
          // System-critical: essential OS processes
          recColor = 'text-neon-blue';
          recText = 'SYSTEM ESSENTIAL - DO NOT TERMINATE';
          safeToTerminate = false;
      } else if (process.analysis.risk_level === 'Critical') {
          // Security-critical: malware/threats - these SHOULD be terminable!
          recColor = 'text-risk-crit';
          recText = 'SECURITY THREAT - TERMINATE RECOMMENDED';
          safeToTerminate = true;
      } else if (process.analysis.risk_level === 'Safe' || process.analysis.recommendation?.toLowerCase().includes('terminate')) {
          recColor = 'text-risk-safe';
          recText = 'SAFE TO TERMINATE';
          safeToTerminate = true;
      } else if (process.analysis.recommendation?.toLowerCase().includes('keep')) {
          recColor = 'text-risk-warn';
          recText = 'RECOMMEND KEEPING';
          safeToTerminate = false;
      } else {
          recColor = 'text-risk-warn';
          recText = 'PROCEED WITH CAUTION';
          safeToTerminate = false; 
      }
  }

  return (
    <div className="h-64 bg-tech-black border-t border-neon-blue/20 p-5 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10 relative font-sans overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-4 tracking-tight">
             {process.name}
             {process.analysis?.risk_level && (
                 <span className={`text-[10px] font-mono px-2 py-0.5 rounded border tracking-wider uppercase
                    ${process.analysis.risk_level === 'Safe' ? 'bg-risk-safe/10 border-risk-safe text-risk-safe' : ''}
                    ${process.analysis.risk_level === 'Bloat' ? 'bg-risk-warn/10 border-risk-warn text-risk-warn' : ''}
                    ${process.analysis.risk_level === 'Critical' ? 'bg-risk-crit/10 border-risk-crit text-risk-crit shadow-[0_0_10px_rgba(255,69,0,0.4)]' : ''}
                    ${process.analysis.risk_level === 'SystemCritical' ? 'bg-neon-blue/10 border-neon-blue text-neon-blue shadow-[0_0_10px_rgba(0,191,255,0.4)]' : ''}
                    ${process.analysis.risk_level === 'Unknown' ? 'bg-gray-500/10 border-gray-500 text-gray-400' : ''}
                 `}>
                     {process.analysis.risk_level}
                 </span>
             )}
          </h2>
          <div className="text-xs font-mono text-neon-blue/60 mt-1 flex gap-4">
              <span>PID: <span className="text-white">{process.pid}</span></span>
              <span>USER: <span className="text-white">{process.user || 'SYSTEM'}</span></span>
          </div>
        </div>
        
        <button
          onClick={() => onTrack(process.pid)}
          disabled={isCritical}
          className={`px-6 py-2 rounded-sm font-bold font-mono text-xs tracking-widest uppercase transition-all duration-300 border
            ${isCritical 
                ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed' 
                : 'bg-transparent border-neon-blue/50 text-neon-blue hover:bg-neon-blue hover:text-black hover:shadow-[0_0_20px_rgba(0,191,255,0.4)]'}
          `}
        >
          {isCritical ? 'LOCKED' : 'TRACK'}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Resources Panel */}
        <div className="col-span-4 space-y-2 border-r border-tech-gray pr-6 overflow-y-auto scrollbar-thin scrollbar-thumb-tech-gray scrollbar-track-transparent">
            <h3 className="text-[10px] font-mono font-bold text-white uppercase tracking-widest mb-3 sticky top-0 bg-tech-black/95 z-10 pb-2">Resource Vector</h3>
            <div className="space-y-4">
                {/* CPU Load */}
                <div className="group">
                    <div className="flex justify-between text-xs text-gray-400 mb-1 font-mono">
                        <span>CPU Load</span>
                        <span className="text-white group-hover:text-neon-cyan transition-colors">{process.cpu.toFixed(1)}%</span>
                    </div>
                    <div className="h-1 bg-gray-800 w-full rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-neon-blue shadow-[0_0_8px_#00BFFF]" 
                            style={{ width: `${Math.min(process.cpu, 100)}%` }}
                        />
                    </div>
                </div>
                
                {/* Memory Details Section */}
                <div className="space-y-3 pt-2 border-t border-gray-800">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Memory Metrics</span>
                        <span 
                            className="text-[8px] text-gray-600 cursor-help" 
                            title="Memory values from systeminformation library. RSS approximates Task Manager's Working Set."
                        >
                            ⓘ
                        </span>
                    </div>
                    
                    {/* Working Set (RSS) */}
                    <div className="group">
                        <div className="flex justify-between text-xs text-gray-400 mb-1 font-mono">
                            <span title="Resident Set Size - memory currently in RAM">Working Set (RSS)</span>
                            <span className="text-white group-hover:text-neon-cyan transition-colors">
                                {(process.mem / 1024 / 1024).toFixed(0)} MB
                            </span>
                        </div>
                        <div className="h-1 bg-gray-800 w-full rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-purple-500 shadow-[0_0_8px_#A855F7]" 
                                style={{ width: `${Math.min((process.mem / (16 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                    
                    {/* Virtual Memory */}
                    {process.memVirtual && (
                        <div className="group">
                            <div className="flex justify-between text-xs text-gray-400 mb-1 font-mono">
                                <span title="Virtual Memory Size - total committed memory">Virtual Memory</span>
                                <span className="text-gray-500 group-hover:text-gray-400 transition-colors text-[11px]">
                                    {(process.memVirtual / 1024 / 1024).toFixed(0)} MB
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {/* Info note */}
                    <div className="text-[9px] text-gray-600 leading-tight pt-1 border-t border-gray-800/50">
                        <span className="opacity-70">Note: RSS ≈ Task Manager's Working Set</span>
                    </div>
                </div>
            </div>
        </div>

        {/* AI Analysis Panel */}
        <div className="col-span-8 flex flex-col min-h-0">
            <h3 className="text-[10px] font-mono font-bold text-white uppercase tracking-widest mb-2 flex items-center gap-2 shrink-0">
                Ai Analysis Matrix
                {process.analysis && <span className="w-1.5 h-1.5 bg-neon-safe rounded-full animate-ping"></span>}
            </h3>
            
            <div className="flex-1 bg-tech-gray/20 rounded border border-white/5 p-4 flex gap-6 relative overflow-y-auto scrollbar-thin scrollbar-thumb-tech-gray scrollbar-track-transparent">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                     <svg width="100" height="100" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.75 9.5 9.75 12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/></svg>
                </div>

                {process.analysis ? (
                    <>
                        <div className="flex-1 z-10">
                            <p className="text-sm text-gray-300 leading-relaxed font-light border-l-2 border-neon-blue/30 pl-3">
                                {process.analysis.description}
                            </p>
                        </div>
                        
                        <div className="w-1/3 flex flex-col items-end justify-center z-10 border-l border-white/10 pl-6 text-right">
                             <div className="text-[10px] uppercase text-gray-500 font-mono tracking-widest mb-1">Recommendation</div>
                             <div className={`text-2xl font-black font-mono leading-none tracking-tighter ${recColor}`}>
                                 {safeToTerminate === true ? 'YES' : safeToTerminate === false ? 'NO' : 'CAUTION'}
                             </div>
                             <div className="text-[10px] font-mono text-gray-400 mt-2">{recText}</div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center w-full h-full text-gray-600 font-mono text-xs">
                        <span className="animate-spin mr-3">⟳</span> INITIATING NEURAL SCAN...
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default InspectorPane;
