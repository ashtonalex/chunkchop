import React from 'react';
import StackedMemoryBar from './StackedMemoryBar';

interface DevModeAnalysis {
  type: 'Leak' | 'Inefficient' | 'Normal' | 'Suspicious';
  analysis: string;
  recommendation: string;
}

interface Process {
  pid: number;
  name: string;
  cpu: number;
  mem: number; // RSS/Working Set in bytes
  memRss?: number; // Total Working Set in bytes
  privateMemory?: number; // PWS in MB
  user?: string;
  analysis?: DevModeAnalysis;
}

interface Props {
  process: Process | null;
  onGenerateReport: (process: Process) => void;
}

const DevModeInspector: React.FC<Props> = ({ process, onGenerateReport }) => {
  if (!process) {
    return (
      <div className="h-72 bg-tech-black border-t border-purple-500/30 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-purple-500/50 text-4xl mb-2 font-thin animate-pulse">DEV MODE</div>
          <div className="text-text-dim text-sm font-mono">Select a process to analyze memory metrics</div>
        </div>
      </div>
    );
  }

  // Calculate memory values
  const privateMemoryMB = process.privateMemory || (process.mem / 1024 / 1024);
  const totalMemoryMB = process.memRss ? process.memRss / 1024 / 1024 : privateMemoryMB;
  const sharedDeltaMB = Math.max(0, totalMemoryMB - privateMemoryMB);

  // Type badge styling
  const getTypeBadgeStyle = (type?: string) => {
    switch (type) {
      case 'Leak':
        return 'bg-red-500/20 border-red-500 text-red-400';
      case 'Inefficient':
        return 'bg-yellow-500/20 border-yellow-500 text-yellow-400';
      case 'Suspicious':
        return 'bg-orange-500/20 border-orange-500 text-orange-400';
      case 'Normal':
        return 'bg-green-500/20 border-green-500 text-green-400';
      default:
        return 'bg-gray-500/20 border-gray-500 text-gray-400';
    }
  };

  const handleGenerateReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      process: {
        name: process.name,
        pid: process.pid,
        user: process.user || 'SYSTEM',
        cpu: process.cpu
      },
      memory: {
        privateWorkingSetMB: privateMemoryMB,
        totalWorkingSetMB: totalMemoryMB,
        sharedDeltaMB: sharedDeltaMB
      },
      analysis: process.analysis || null
    };
    
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    onGenerateReport(process);
  };

  return (
    <div className="h-72 bg-tech-black border-t border-purple-500/30 p-5 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10 relative font-sans overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
            {process.name}
            {process.analysis?.type && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border tracking-wider uppercase ${getTypeBadgeStyle(process.analysis.type)}`}>
                {process.analysis.type}
              </span>
            )}
          </h2>
          <div className="text-xs font-mono text-purple-400/60 mt-1 flex gap-4">
            <span>PID: <span className="text-white">{process.pid}</span></span>
            <span>USER: <span className="text-white">{process.user || 'SYSTEM'}</span></span>
            <span>CPU: <span className="text-white">{process.cpu.toFixed(1)}%</span></span>
          </div>
        </div>
        
        <button
          onClick={handleGenerateReport}
          className="px-4 py-2 rounded-sm font-bold font-mono text-xs tracking-widest uppercase transition-all duration-300 border bg-purple-500/10 border-purple-500/50 text-purple-400 hover:bg-purple-500/20 hover:border-purple-400 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]"
        >
          Generate Report
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Memory Visualization Panel */}
        <div className="col-span-5 space-y-3 border-r border-gray-800 pr-4 overflow-y-auto">
          <h3 className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest mb-2">
            Memory Profile
          </h3>
          
          <StackedMemoryBar
            privateMemory={privateMemoryMB}
            totalMemory={totalMemoryMB}
            maxMemory={Math.max(1024, totalMemoryMB * 1.2)}
          />
          
          {/* Detailed Metrics */}
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs font-mono">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2 text-center">
              <div className="text-blue-400 text-lg font-bold">{privateMemoryMB.toFixed(0)}</div>
              <div className="text-gray-500 text-[9px] uppercase">PWS (MB)</div>
            </div>
            <div className="bg-gray-500/10 border border-gray-500/30 rounded p-2 text-center">
              <div className="text-gray-300 text-lg font-bold">{sharedDeltaMB.toFixed(0)}</div>
              <div className="text-gray-500 text-[9px] uppercase">Shared</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded p-2 text-center">
              <div className="text-purple-300 text-lg font-bold">{totalMemoryMB.toFixed(0)}</div>
              <div className="text-gray-500 text-[9px] uppercase">Total WS</div>
            </div>
          </div>
        </div>

        {/* Heuristic Analysis Panel */}
        <div className="col-span-7 flex flex-col min-h-0">
          <h3 className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            Heuristic Analysis
            {process.analysis && <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping"></span>}
          </h3>
          
          <div className="flex-1 bg-gray-900/50 rounded border border-purple-500/20 p-3 overflow-y-auto">
            {process.analysis ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[9px] uppercase text-gray-500 font-mono mb-1">Technical Insight</div>
                  <p className="text-sm text-gray-300 leading-relaxed border-l-2 border-purple-500/30 pl-3">
                    {process.analysis.analysis}
                  </p>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-gray-500 font-mono mb-1">Recommended Action</div>
                  <p className="text-sm text-purple-300 font-medium">
                    {process.analysis.recommendation}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 font-mono text-xs">
                <span className="animate-spin mr-3">⟳</span> Run Dev Mode analysis to see heuristic insights...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevModeInspector;
