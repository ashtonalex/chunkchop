import React, { useEffect, useRef } from 'react';

export interface AnalysisLogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'progress' | 'retry' | 'error' | 'success' | 'provider';
  message: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  logs: AnalysisLogEntry[];
}

const AnalysisLogsModal: React.FC<Props> = ({ isOpen, onClose, onClear, logs }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const getLogIcon = (type: AnalysisLogEntry['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'retry':
        return '↻';
      case 'progress':
        return '▸';
      case 'provider':
        return '◈';
      default:
        return '•';
    }
  };

  const getLogColor = (type: AnalysisLogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-400 border-green-400/30 bg-green-400/5';
      case 'error':
        return 'text-red-400 border-red-400/30 bg-red-400/5';
      case 'retry':
        return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5';
      case 'progress':
        return 'text-neon-blue border-neon-blue/30 bg-neon-blue/5';
      case 'provider':
        return 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5';
      default:
        return 'text-gray-400 border-gray-400/30 bg-gray-400/5';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-tech-black border border-tech-gray rounded-sm w-full max-w-3xl max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(0,255,255,0.1)]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-tech-gray bg-black/40">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3 font-mono">
            <span className="text-neon-cyan">◈</span> ANALYSIS LOGS
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar bg-black/20">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 font-mono border border-dashed border-gray-800 rounded">
              <span className="text-2xl mb-2 opacity-50">∅</span>
              <span>NO ANALYSIS LOGS YET</span>
              <span className="text-xs mt-2 opacity-50">Click "Analyze All" to start</span>
            </div>
          ) : (
            <>
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className={`border rounded-sm p-2 flex items-start gap-3 font-mono text-xs transition-all ${getLogColor(log.type)}`}
                >
                  <span className="text-base leading-none mt-0.5">{getLogIcon(log.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] opacity-60 font-mono tabular-nums">
                        {formatTime(log.timestamp)}
                      </span>
                      <span className="text-[9px] uppercase opacity-40 tracking-wider">
                        {log.type}
                      </span>
                    </div>
                    <div className="mt-1 leading-relaxed break-words">
                      {log.message}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-3 border-t border-tech-gray bg-black/40 text-[10px] text-gray-500 font-mono flex justify-between items-center">
          <span>TOTAL ENTRIES: <span className="text-white">{logs.length}</span></span>
          <div className="flex gap-4 items-center">
            <button 
              onClick={onClear}
              disabled={logs.length === 0}
              className="text-[10px] text-red-500 hover:text-red-400 hover:underline transition-colors uppercase font-bold tracking-wider mr-4 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Clear Logs
            </button>
            <span className="opacity-50">REV: 1.0.0</span>
            <span className="text-neon-cyan/50">AI MONITOR</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisLogsModal;
