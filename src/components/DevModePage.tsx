import React, { useState, useMemo } from 'react';
import DevModeInspector from './DevModeInspector';
import MemoryBreakdownChart from './MemoryBreakdownChart';

interface DevModeAnalysis {
  type: 'Leak' | 'Inefficient' | 'Normal' | 'Suspicious';
  analysis: string;
  recommendation: string;
}

interface Process {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  memRss?: number;
  privateMemory?: number;
  user?: string;
  analysis?: DevModeAnalysis;
}

interface Props {
  processes: Process[];
  onExitDevMode: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

const DevModePage: React.FC<Props> = ({ processes, onExitDevMode, onAnalyze, isAnalyzing }) => {
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [reportGenerated, setReportGenerated] = useState(false);

  // Filter and sort processes
  const filteredProcesses = useMemo(() => {
    return processes
      .filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'All' || p.analysis?.type === typeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        // Sort by memory usage (highest first)
        const aMemory = a.privateMemory || (a.mem / 1024 / 1024);
        const bMemory = b.privateMemory || (b.mem / 1024 / 1024);
        return bMemory - aMemory;
      });
  }, [processes, searchTerm, typeFilter]);

  const selectedProcess = processes.find(p => p.pid === selectedPid) || null;

  const handleGenerateReport = (_process: Process) => {
    setReportGenerated(true);
    setTimeout(() => setReportGenerated(false), 2000);
  };

  // Get type badge styling
  const getTypeBadge = (type?: string) => {
    const baseClasses = 'px-1.5 py-0.5 rounded text-[9px] font-mono uppercase border';
    switch (type) {
      case 'Leak':
        return `${baseClasses} bg-red-500/20 border-red-500/50 text-red-400`;
      case 'Inefficient':
        return `${baseClasses} bg-yellow-500/20 border-yellow-500/50 text-yellow-400`;
      case 'Suspicious':
        return `${baseClasses} bg-orange-500/20 border-orange-500/50 text-orange-400`;
      case 'Normal':
        return `${baseClasses} bg-green-500/20 border-green-500/50 text-green-400`;
      default:
        return `${baseClasses} bg-gray-500/20 border-gray-500/50 text-gray-500`;
    }
  };

  // Count by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { All: processes.length };
    processes.forEach(p => {
      const type = p.analysis?.type || 'Unanalyzed';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [processes]);

  return (
    <div className="flex flex-col h-screen bg-tech-black text-text-main overflow-hidden font-sans">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-3 border-b border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-tech-black">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
            <h1 className="text-xl font-bold text-white tracking-tight">DEV MODE</h1>
          </div>
          <span className="text-xs font-mono text-purple-400/60">
            Advanced Memory Profiler
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {reportGenerated && (
            <span className="text-xs font-mono text-green-400 animate-pulse">
              ✓ Report copied to clipboard
            </span>
          )}
          
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="px-4 py-1.5 text-xs font-mono font-medium text-purple-400 border border-purple-500/50 bg-purple-500/10 rounded hover:bg-purple-500/20 hover:border-purple-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing...
              </>
            ) : (
              <>Analyze All</>
            )}
          </button>
          
          <button
            onClick={onExitDevMode}
            className="px-4 py-1.5 text-xs font-mono text-gray-400 border border-gray-600 rounded hover:bg-gray-800 hover:text-white transition-all"
          >
            Exit Dev Mode
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Process List */}
        <div className="w-1/3 min-w-[350px] border-r border-purple-500/20 flex flex-col">
          {/* Filters */}
          <div className="p-4 border-b border-gray-800 space-y-3">
            <input
              type="text"
              placeholder="Search processes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 rounded focus:border-purple-500 focus:outline-none"
            />
            
            <div className="flex gap-2 flex-wrap">
              {['All', 'Leak', 'Inefficient', 'Suspicious', 'Normal'].map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-2 py-1 text-[10px] font-mono rounded border transition-all ${
                    typeFilter === type
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
                  }`}
                >
                  {type} {typeCounts[type] ? `(${typeCounts[type]})` : ''}
                </button>
              ))}
            </div>
          </div>
          
          {/* Process Items */}
          <div className="flex-1 overflow-y-auto">
            {filteredProcesses.map(process => {
              const memoryMB = process.privateMemory || (process.mem / 1024 / 1024);
              const isSelected = process.pid === selectedPid;
              
              return (
                <div
                  key={process.pid}
                  onClick={() => setSelectedPid(process.pid)}
                  className={`px-4 py-3 border-b border-gray-800/50 cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-purple-500/10 border-l-2 border-l-purple-500' 
                      : 'hover:bg-gray-900/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-medium text-sm ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                      {process.name}
                    </span>
                    {process.analysis?.type && (
                      <span className={getTypeBadge(process.analysis.type)}>
                        {process.analysis.type}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-4 text-[10px] font-mono text-gray-500">
                    <span>PID: {process.pid}</span>
                    <span>PWS: {memoryMB.toFixed(0)} MB</span>
                    <span>CPU: {process.cpu.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
            
            {filteredProcesses.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
                No processes match filters
              </div>
            )}
          </div>
        </div>
        
        {/* Inspector/Visualization Area */}
        <div className="flex-1 flex flex-col bg-gray-900/30">
          <div className="flex-1 p-6 overflow-y-auto">
            <MemoryBreakdownChart processes={processes} maxProcesses={15} />
          </div>
          
          {/* Bottom Inspector */}
          <DevModeInspector
            process={selectedProcess}
            onGenerateReport={handleGenerateReport}
          />
        </div>
      </div>
    </div>
  );
};

export default DevModePage;
