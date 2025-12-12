import React from 'react';

interface Process {
  pid: number;
  name: string;
  user?: string;
  analysis?: {
    risk_level: string;
  };
  [key: string]: any;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  processes: Process[];
}

const TrackingModal: React.FC<Props> = ({ isOpen, onClose, onClear, processes }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-tech-black border border-tech-gray rounded-sm w-full max-w-2xl max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(0,191,255,0.1)]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-tech-gray bg-black/40">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3 font-mono">
                <span className="text-neon-blue">◈</span> TRACKED PROCESS LOGS
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
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {processes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 font-mono border border-dashed border-gray-800 rounded">
                    <span className="text-2xl mb-2 opacity-50">∅</span>
                    <span>NO PROCESSES CURRENTLY BEING TRACKED</span>
                </div>
            ) : (
                processes.map((p, idx) => (
                    <div key={`${p.pid}-${idx}`} className="bg-white/5 border border-white/5 p-3 rounded-sm flex justify-between items-center hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="font-mono text-xs text-gray-500 w-8">{(idx + 1).toString().padStart(2, '0')}</div>
                            <div>
                                <div className="text-neon-blue font-bold text-sm mb-0.5 tracking-wide">{p.name}</div>
                                <div className="text-[10px] text-gray-400 font-mono flex gap-3">
                                    <span>PID: <span className="text-gray-300">{p.pid}</span></span>
                                    <span>USER: <span className="text-gray-300">{p.user || 'SYSTEM'}</span></span>
                                </div>
                            </div>
                        </div>
                        {p.analysis && (
                            <div className={`text-[10px] px-2 py-1 rounded-sm border font-mono uppercase tracking-wider
                                ${p.analysis.risk_level === 'Critical' ? 'border-risk-crit text-risk-crit bg-risk-crit/10 shadow-[0_0_10px_rgba(255,69,0,0.2)]' : 
                                  p.analysis.risk_level === 'Bloat' ? 'border-risk-warn text-risk-warn bg-risk-warn/10' : 
                                  'border-risk-safe text-risk-safe bg-risk-safe/10'}
                            `}>
                                {p.analysis.risk_level}
                            </div>
                        )}
                        {!p.analysis && (
                             <div className="text-[10px] text-gray-600 font-mono italic">NO ANALYSIS</div>
                        )}
                    </div>
                ))
            )}
        </div>
        
        {/* Footer */}
        <div className="p-3 border-t border-tech-gray bg-black/40 text-[10px] text-gray-500 font-mono flex justify-between items-center">
            <span>TOTAL TRACKED: <span className="text-white">{processes.length}</span></span>
            <div className="flex gap-4 items-center">
                 <button 
                    onClick={onClear}
                    className="text-[10px] text-red-500 hover:text-red-400 hover:underline transition-colors uppercase font-bold tracking-wider mr-4"
                 >
                    Clear Logs
                 </button>
                 <span className="opacity-50">REV: 1.0.4</span>
                 <span className="text-neon-cyan/50">MEMORY MATRIX</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingModal;
