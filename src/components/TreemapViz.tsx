import React, { useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';

interface Process {
  pid: number;
  name: string;
  cpu: number;
  mem: number; // RSS/Working Set
  memVirtual?: number; // Virtual memory (optional)
  analysis?: {
    risk_level: string;
  };
}

interface Props {
  processes: Process[];
  onSelect: (pid: number) => void;
}


const TreemapViz: React.FC<Props> = ({ processes, onSelect }) => {
  // Transform data for Treemap
  const data = useMemo(() => {
    // Filter out processes under 40MB for visualization clarity
    const validProcesses = processes.filter(p => p.mem > 30 * 1024 * 1024);
    
    // Color mapping for risk levels (Muted Professional Palette)
    const colorMap: Record<string, string> = {
      'Safe': '#C83F12',     
      'Bloat': '#8A0000',     
      'Critical': '#3B060A',  
      'Unknown': '#ff8000ff',   
      'Unanalyzed': '#000000ff' 
    };
    
    // Group by Risk Level
    const grouped = {
        name: 'Processes',
        children: [
            { name: 'Critical', children: [] as any[] }, // Prioritize Critical in order? Recharts might sort by size anyway
            { name: 'Bloat', children: [] as any[] },
            { name: 'Safe', children: [] as any[] },
            { name: 'Unknown', children: [] as any[] },
            { name: 'Unanalyzed', children: [] as any[] }
        ]
    };

    validProcesses.forEach(p => {
       const risk = p.analysis?.risk_level || 'Unanalyzed';
       const targetGroup = grouped.children.find(g => g.name === risk) || grouped.children.find(g => g.name === 'Unanalyzed');
       
       // Fallback color if risk not found
       const fillColor = colorMap[risk] || '#333';

       targetGroup?.children.push({
           ...p,
           name: p.name,
           value: p.mem,  // Changed from 'size' to 'value' for Recharts
           pid: p.pid,
           risk: risk,
           fill: fillColor 
       });
    });
    
    // Filter out empty groups 
    grouped.children = grouped.children.filter(g => g.children.length > 0);
    
    return [grouped];
  }, [processes]);

  if (!data || !data[0] || !data[0].children || data[0].children.length === 0) {
      return (
          <div className="h-full w-full bg-tech-black flex flex-col items-center justify-center relative border-b border-tech-gray min-h-[400px]">

              <div className="text-text-dim text-xs font-mono animate-pulse">AWAITING DATA STREAM...</div>
              <div className="text-text-dim/50 text-[10px] font-mono mt-2">Initialize analysis to populate matrix</div>
          </div>
      );
  }

  return (
    <div className="h-full w-full bg-tech-black overflow-hidden relative border-b border-tech-gray shadow-[inset_0_-20px_40px_rgba(0,0,0,0.8)]">

      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="value"
          aspectRatio={16 / 9}
          fill="#ffffffff"  
          onClick={(data) => {
              if (data && data.pid) onSelect(data.pid);
          }}
          animationDuration={400}
        >
             <Tooltip 
                cursor={{ stroke: '#00BFFF', strokeWidth: 1, fill: 'transparent' }}
                content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        
                        // Safety check: Don't render tooltip for group nodes (which lack risk/pid)
                        if (!data || !data.risk) return null;

                        return (
                            <div className="bg-tech-black/90 backdrop-blur border border-neon-blue/50 p-3 rounded shadow-[0_0_15px_rgba(0,0,0,0.8)] text-xs font-mono z-50 min-w-[150px]">
                                <p className="font-bold text-white mb-2 text-sm border-b border-gray-700 pb-1">{data.name}</p>
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">PID:</span>
                                        <span className="text-white">{data.pid}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">MEM:</span>
                                        <span className="text-white">{(data.value / 1024 / 1024).toFixed(0)} MB</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-700">
                                        <span className="text-gray-400">RISK:</span>
                                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                            data.risk === 'Critical' ? 'bg-risk-crit text-white' :
                                            data.risk === 'Bloat' ? 'bg-risk-warn text-white' :
                                            data.risk === 'Safe' ? 'bg-risk-safe text-white' :
                                            'bg-gray-700 text-white'
                                        }`}>{data.risk ? data.risk.toUpperCase() : 'UNKNOWN'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    return null;
                }}
             />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
};

// Use memo to prevent re-renders if data doesn't change deeply, 
// though we recreate 'data' object on every Processes change.
const MemoizedTreemapViz = React.memo(TreemapViz);
export default MemoizedTreemapViz;
