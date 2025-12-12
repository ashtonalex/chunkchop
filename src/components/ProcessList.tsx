import React from 'react';

import { Process, FilterOptions } from '../types';

interface Props {
  processes: Process[];
  selectedPid: number | null;
  onSelect: (pid: number) => void;
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
}

const ProcessList: React.FC<Props> = ({ processes, selectedPid, onSelect, filters, onFilterChange }) => {
  const { searchTerm, riskFilter, minCpu, minMem } = filters;
  
  const updateFilter = (key: keyof FilterOptions, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const filteredProcesses = React.useMemo(() => {
    return processes.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRisk = riskFilter === 'All' || p.analysis?.risk_level === riskFilter;
      const matchesCpu = p.cpu >= minCpu;
      const matchesMem = (p.mem / 1024 / 1024) >= minMem;
      return matchesSearch && matchesRisk && matchesCpu && matchesMem;
    });
  }, [processes, searchTerm, riskFilter, minCpu, minMem]);

  return (
    <div className="h-full bg-tech-black/90 flex flex-col font-mono text-xs">
      <div className="p-3 border-b border-tech-gray bg-tech-gray/30 text-white font-bold tracking-wider uppercase text-[10px] flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span>Process Stream</span>
          <span className="text-text-dim text-[9px]">{filteredProcesses.length}/{processes.length} ACTV</span>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2">
          {/* Search & Risk */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="SEARCH PROCESS..."
              value={searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              className="flex-1 bg-tech-black/50 border border-tech-gray rounded px-2 py-1 text-neon-blue focus:outline-none focus:border-neon-blue placeholder-gray-600"
            />
            <select
              value={riskFilter}
              onChange={(e) => updateFilter('riskFilter', e.target.value)}
              className="bg-tech-black/50 border border-tech-gray rounded px-2 py-1 text-white focus:outline-none focus:border-neon-blue cursor-pointer"
            >
              <option value="All">ALL RISKS</option>
              <option value="SystemCritical">SYSTEM CRITICAL</option>
              <option value="Critical">CRITICAL</option>
              <option value="Bloat">BLOAT</option>
              <option value="Safe">SAFE</option>
              <option value="Unknown">UNKNOWN</option>
            </select>
          </div>

          {/* Sliders */}
          <div className="flex gap-4 px-1">
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex justify-between text-[9px] text-gray-400">
                <span>MIN CPU</span>
                <span className="text-neon-blue">{minCpu}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={minCpu}
                onChange={(e) => updateFilter('minCpu', Number(e.target.value))}
                className="w-full accent-neon-blue h-1 bg-tech-gray rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex justify-between text-[9px] text-gray-400">
                <span>MIN MEM</span>
                <span className="text-neon-blue">{minMem}MB</span>
              </div>
              <input
                type="range"
                min="0"
                max="2000"
                step="50"
                value={minMem}
                onChange={(e) => updateFilter('minMem', Number(e.target.value))}
                className="w-full accent-neon-blue h-1 bg-tech-gray rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-tech-gray scrollbar-track-transparent">
        {filteredProcesses.map((p) => {
           let statusColor = 'bg-gray-700';
           if (p.analysis?.risk_level === 'SystemCritical') statusColor = 'bg-neon-blue shadow-[0_0_8px_#00BFFF]';
           if (p.analysis?.risk_level === 'Safe') statusColor = 'bg-risk-safe shadow-[0_0_5px_#39FF14]';
           if (p.analysis?.risk_level === 'Bloat') statusColor = 'bg-risk-warn shadow-[0_0_5px_#FFD700]';
           if (p.analysis?.risk_level === 'Critical') statusColor = 'bg-risk-crit shadow-[0_0_8px_#FF4500] animate-pulse';
           if (p.analysis?.risk_level === 'Unknown') statusColor = 'bg-gray-600';

           const isSelected = selectedPid === p.pid;

           return (
            <div
              key={p.pid}
              onClick={() => onSelect(p.pid)}
              className={`group flex items-center gap-3 p-2 cursor-pointer border-l-2 border-b border-b-tech-gray/50 transition-all duration-200 hover:bg-white/5 ${
                isSelected 
                  ? 'bg-neon-blue/10 border-l-neon-blue border-b-neon-blue/30' 
                  : 'border-l-transparent'
              }`}
            >
              {/* Risk Indicator Dot */}
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor} shrink-0`} />

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className={`truncate font-bold max-w-[160px] ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`} title={p.name}>
                    {p.name}
                  </span>
                  <span className="text-[10px] text-gray-600 group-hover:text-neon-blue/70">{p.pid}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span className={p.cpu > 10 ? 'text-risk-warn' : ''}>CPU: {p.cpu.toFixed(1).padStart(4, '0')}%</span>
                  <span title="Working Set (RSS) - approximate memory in RAM">MEM: {(p.mem / 1024 / 1024).toFixed(0).padStart(4, ' ')}MB</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProcessList;
