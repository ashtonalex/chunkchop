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
                  className={`py-1.5 px-2 flex items-start gap-3 font-mono text-xs transition-all hover:bg-white/5 border-l-2 ${
                    log.type === 'error' ? 'border-red-500/50' : 
                    log.type === 'success' ? 'border-green-500/50' : 
                    log.type === 'retry' ? 'border-yellow-500/50' : 
                    log.type === 'provider' ? 'border-neon-cyan/50' : 
                    'border-transparent'
                  }`}
                >
                  <span className={`text-base leading-none mt-0.5 ${
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'success' ? 'text-green-400' : 
                    log.type === 'retry' ? 'text-yellow-400' : 
                    log.type === 'progress' ? 'text-neon-blue' : 
                    log.type === 'provider' ? 'text-neon-cyan' : 
                    'text-gray-500'
                  }`}>{getLogIcon(log.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] text-gray-600 font-mono tabular-nums">
                        {formatTime(log.timestamp)}
                      </span>
                      {log.type !== 'info' && (
                        <span className={`text-[9px] uppercase tracking-wider ${
                          log.type === 'error' ? 'text-red-500/70' : 
                          log.type === 'success' ? 'text-green-500/70' : 
                          log.type === 'retry' ? 'text-yellow-500/70' : 
                          log.type === 'progress' ? 'text-neon-blue/70' : 
                          log.type === 'provider' ? 'text-neon-cyan/70' : 
                          'text-gray-600'
                        }`}>
                          {log.type}
                        </span>
                      )}
                    </div>
                    <div className={`mt-0.5 leading-relaxed break-words ${
                      log.type === 'error' ? 'text-red-300' : 
                      log.type === 'success' ? 'text-green-300' : 
                      'text-gray-300'
                    }`}>
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
