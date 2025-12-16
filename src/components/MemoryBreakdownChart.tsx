import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// Process type matching the app's structure
interface ProcessItem {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  memRss?: number;
  privateMemory?: number;
}

interface Props {
  processes: ProcessItem[];
  maxProcesses?: number; // Default: 15
}

// Transformed data structure for the chart
interface ChartDataItem {
  name: string;
  privateMemory: number;
  sharedDelta: number;
  totalWS: number;
}

// Custom tooltip component
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    payload: ChartDataItem;
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  
  return (
    <div className="bg-gray-900/95 border border-purple-500/40 rounded-lg p-3 shadow-xl backdrop-blur-sm">
      <p className="text-white font-semibold text-sm mb-2 border-b border-gray-700 pb-2">
        {data.name}
      </p>
      <div className="space-y-1.5 text-xs font-mono">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
            <span className="text-gray-400">Private (PWS):</span>
          </span>
          <span className="text-white font-medium">{data.privateMemory.toFixed(1)} MB</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-2">
            <span 
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: 'repeating-linear-gradient(45deg, #9CA3AF, #9CA3AF 1px, #6B7280 1px, #6B7280 2px)' }}
            />
            <span className="text-gray-400">Shared Delta:</span>
          </span>
          <span className="text-gray-300">{data.sharedDelta.toFixed(1)} MB</span>
        </div>
        <div className="flex justify-between gap-4 pt-1.5 border-t border-gray-700">
          <span className="text-gray-400">Total WS:</span>
          <span className="text-purple-400 font-semibold">{data.totalWS.toFixed(1)} MB</span>
        </div>
      </div>
    </div>
  );
};

const MemoryBreakdownChart: React.FC<Props> = ({ 
  processes, 
  maxProcesses = 15 
}) => {
  // Transform the data for the chart
  const chartData = useMemo<ChartDataItem[]>(() => {
    return processes
      .map(p => {
        // Get private memory in MB (already in MB from backend, or convert from bytes)
        const privateMemoryMB = p.privateMemory ?? (p.mem / 1024 / 1024);
        
        // Get total working set in MB (memRss is in bytes)
        const totalWSMB = p.memRss 
          ? p.memRss / 1024 / 1024 
          : privateMemoryMB; // Fallback to private memory if memRss unavailable
        
        // Calculate shared delta (WS - PWS), ensure non-negative
        const sharedDeltaMB = Math.max(0, totalWSMB - privateMemoryMB);
        
        return {
          name: p.name.length > 20 ? `${p.name.substring(0, 18)}...` : p.name,
          privateMemory: privateMemoryMB,
          sharedDelta: sharedDeltaMB,
          totalWS: totalWSMB,
        };
      })
      // Sort by total working set (descending) and take top N
      .sort((a, b) => b.totalWS - a.totalWS)
      .slice(0, maxProcesses);
  }, [processes, maxProcesses]);

  // If no data, show empty state
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        <div className="text-center">
          <div className="text-4xl mb-2 opacity-30">📊</div>
          <div className="text-sm">No processes to display</div>
        </div>
      </div>
    );
  }

  // Calculate dynamic height based on number of processes
  const chartHeight = Math.max(400, chartData.length * 32);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Chart Title & Legend */}
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="text-sm font-semibold text-white">
          Top {chartData.length} Memory Consumers
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-indigo-500" />
            <span className="text-gray-400">Private (PWS)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div 
              className="w-3 h-3 rounded-sm"
              style={{ background: 'repeating-linear-gradient(45deg, #9CA3AF, #9CA3AF 1px, #6B7280 1px, #6B7280 2px)' }}
            />
            <span className="text-gray-400">Shared Delta</span>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            barCategoryGap="20%"
          >
            <XAxis 
              type="number"
              tickFormatter={(value) => `${value.toFixed(0)} MB`}
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={{ stroke: '#374151' }}
            />
            <YAxis 
              type="category"
              dataKey="name"
              tick={{ fill: '#D1D5DB', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
              width={75}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
            />
            
            {/* Private Memory Bar (Solid Indigo) */}
            <Bar 
              dataKey="privateMemory" 
              stackId="memory"
              fill="#4F46E5"
              radius={[0, 0, 0, 0]}
            >
              {chartData.map((_, index) => (
                <Cell 
                  key={`private-${index}`}
                  fill="#4F46E5"
                />
              ))}
            </Bar>
            
            {/* Shared Delta Bar (Striped Gray Pattern) */}
            <Bar 
              dataKey="sharedDelta" 
              stackId="memory"
              fill="#9CA3AF"
              radius={[0, 4, 4, 0]}
            >
              {chartData.map((_, index) => (
                <Cell 
                  key={`shared-${index}`}
                  fill="url(#stripedPattern)"
                />
              ))}
            </Bar>
            
            {/* SVG Defs for Striped Pattern */}
            <defs>
              <pattern 
                id="stripedPattern" 
                patternUnits="userSpaceOnUse" 
                width="4" 
                height="4"
                patternTransform="rotate(45)"
              >
                <rect width="2" height="4" fill="#9CA3AF" />
                <rect x="2" width="2" height="4" fill="#6B7280" />
              </pattern>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MemoryBreakdownChart;
