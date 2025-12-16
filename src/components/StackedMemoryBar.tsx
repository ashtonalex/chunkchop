import React from 'react';

interface Props {
  privateMemory: number;  // PWS in MB
  totalMemory: number;    // WS in MB (Total Working Set)
  maxMemory?: number;     // Scale reference (default: 1024 MB)
  showLabels?: boolean;
}

const StackedMemoryBar: React.FC<Props> = ({ 
  privateMemory, 
  totalMemory, 
  maxMemory = 1024,
  showLabels = true 
}) => {
  // Calculate shared memory delta (WS - PWS)
  const sharedDelta = Math.max(0, totalMemory - privateMemory);
  
  // Calculate percentages for bar widths
  const scale = Math.max(maxMemory, totalMemory);
  const pwsPercent = (privateMemory / scale) * 100;
  const sharedPercent = (sharedDelta / scale) * 100;
  
  return (
    <div className="space-y-2">
      {/* Stacked Bar */}
      <div className="h-4 bg-gray-800 rounded-full overflow-hidden flex">
        {/* Private Working Set (Solid Blue) */}
        <div 
          className="h-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-300"
          style={{ width: `${pwsPercent}%` }}
          title={`Private Working Set: ${privateMemory.toFixed(1)} MB`}
        />
        {/* Shared Memory Delta (Striped Grey) */}
        <div 
          className="h-full transition-all duration-300"
          style={{ 
            width: `${sharedPercent}%`,
            background: 'repeating-linear-gradient(45deg, #4B5563, #4B5563 2px, #374151 2px, #374151 4px)'
          }}
          title={`Shared Delta: ${sharedDelta.toFixed(1)} MB`}
        />
      </div>
      
      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between text-xs font-mono">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-blue-600 to-blue-500" />
              <span className="text-gray-400">PWS:</span>
              <span className="text-white font-medium">{privateMemory.toFixed(0)} MB</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-sm"
                style={{ background: 'repeating-linear-gradient(45deg, #4B5563, #4B5563 1px, #374151 1px, #374151 2px)' }}
              />
              <span className="text-gray-400">Shared:</span>
              <span className="text-gray-300">{sharedDelta.toFixed(0)} MB</span>
            </div>
          </div>
          <div className="text-gray-500">
            Total: <span className="text-gray-300">{totalMemory.toFixed(0)} MB</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StackedMemoryBar;
