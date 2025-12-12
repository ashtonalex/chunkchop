import { useState, useEffect, useRef } from 'react'
import './App.css'
import SettingsModal from './components/SettingsModal';
import ProcessList from './components/ProcessList';
import TreemapViz from './components/TreemapViz';
import InspectorPane from './components/InspectorPane';
import TrackingModal from './components/TrackingModal';
import AnalysisLogsModal, { AnalysisLogEntry } from './components/AnalysisLogsModal';
// Components import is implicit if file structure matches, but standard import

function App() {
  const [processes, setProcesses] = useState<any[]>([])
  const [treemapProcesses, setTreemapProcesses] = useState<any[]>([])
  const isTreemapInitializedRef = useRef(false);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackedProcesses, setTrackedProcesses] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalysisLogsOpen, setIsAnalysisLogsOpen] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<AnalysisLogEntry[]>([]);
  
  // Handle tracking process
  const handleTrackProcess = (pid: number) => {
      const processToTrack = processes.find(p => p.pid === pid);
      if (processToTrack) {
          // Check if already tracked
          if (!trackedProcesses.some(p => p.pid === pid)) {
              setTrackedProcesses(prev => [...prev, processToTrack]);
              // Optional: Provide feedback?
          }
      }
  };

  const handleClearTrackedProcesses = () => {
    setTrackedProcesses([]);
  };

  const handleClearAnalysisLogs = () => {
    setAnalysisLogs([]);
  };

  const addAnalysisLog = (type: AnalysisLogEntry['type'], message: string) => {
    const logEntry: AnalysisLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type,
      message
    };
    setAnalysisLogs(prev => [...prev, logEntry]);
  };

  const handleBatchAnalyze = async () => {
    setIsAnalyzing(true);
    // Clear previous logs and open modal
    setAnalysisLogs([]);
    setIsAnalysisLogsOpen(true);
    addAnalysisLog('info', 'Starting batch analysis...');
    
    try {
      // @ts-ignore
      const result = await window.ipcRenderer.invoke('batch-analyze');
      if (result.success) {
        console.log(`Batch analysis complete: ${result.message}`);
        addAnalysisLog('success', result.message || `Analysis complete: ${result.count} processes analyzed`);
      } else {
        addAnalysisLog('error', `Analysis failed: ${result.error}`);
        alert(`Analysis failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Batch analysis error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addAnalysisLog('error', `Failed to analyze processes: ${errorMsg}`);
      alert('Failed to analyze processes');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRefreshTreemap = () => {
    setTreemapProcesses(processes);
  };

  useEffect(() => {
    // @ts-ignore
    window.ipcRenderer.on('processes-update', (_event, data) => {
      const uniqueProcesses = deduplicateProcesses(data);
      setProcesses(uniqueProcesses);
      
      // Initialize treemap data once
      if (!isTreemapInitializedRef.current && uniqueProcesses.length > 0) {
        setTreemapProcesses(uniqueProcesses);
        isTreemapInitializedRef.current = true;
      }
      
      // If we have a selected PID, keep it selected? Yes, unless it died.
    });
    
    // Listener for individual updates if we want (analysis-complete)
    // @ts-ignore
    window.ipcRenderer.on('analysis-complete', (_event, analysis) => {
        // Update the process list item with this analysis
        setProcesses(prev => prev.map(p => {
            if (p.name === analysis.process_name) {
                return { ...p, analysis };
            }
            return p;
        }));
    });

    // Listener for batch analysis completion
    // @ts-ignore
    window.ipcRenderer.on('batch-analysis-complete', (_event, data) => {
      console.log(`Batch analysis completed: ${data.count} processes analyzed`);
      addAnalysisLog('success', `✓ Batch analysis completed: ${data.count} processes analyzed at ${new Date(data.timestamp).toLocaleTimeString()}`);
      // Processes will update on next poll cycle automatically
    });

    // Listener for batch analysis progress
    // @ts-ignore
    window.ipcRenderer.on('batch-analysis-progress', (_event, data) => {
      addAnalysisLog('progress', `Processing batch ${data.currentBatch}/${data.totalBatches} (${data.processesInBatch} processes)`);
    });

    // Listener for AI provider selection
    // @ts-ignore
    window.ipcRenderer.on('ai-provider-selected', (_event, data) => {
      addAnalysisLog('provider', `Using AI provider: ${data.provider}`);
    });

    // Listener for retry attempts
    // @ts-ignore
    window.ipcRenderer.on('batch-analysis-retry', (_event, data) => {
      addAnalysisLog('retry', `Retrying with ${data.provider}... Attempt ${data.attempt}/${data.maxRetries}`);
    });

    // Listener for generic batch analysis logs
    // @ts-ignore
    window.ipcRenderer.on('batch-analysis-log', (_event, data) => {
      addAnalysisLog(data.type || 'info', data.message);
    });
    
  }, []);

  const selectedProcess = processes.find(p => p.pid === selectedPid) || null;

  return (
    <div className="flex h-screen bg-tech-black text-text-main overflow-hidden font-sans relative selection:bg-neon-blue selection:text-black">



      {/* Sidebar - Process List */}
      <div className="w-1/4 min-w-[300px] h-full border-r border-tech-gray flex flex-col bg-black/60 backdrop-blur-sm z-20 overflow-hidden">
        <ProcessList 
            processes={processes} 
            selectedPid={selectedPid} 
            onSelect={setSelectedPid} 
        />
      </div>

      {/* Main Content */}
      <div className="w-3/4 flex-1 flex flex-col min-w-0 bg-tech-black relative">
          
          {/* Header Bar */}
          <div className="flex justify-between items-center p-3 border-b border-tech-gray bg-tech-black/80 backdrop-blur-sm z-30">
              <h3 className="">
              </h3>
              
              <div className="flex items-center gap-3">
                  {/* View Logs Button */}
                  <button 
                      onClick={() => setIsTrackingModalOpen(true)}
                      className="px-3 py-1 text-xs font-mono font-medium text-text-dim border border-text-dim/30 bg-tech-gray rounded hover:bg-tech-gray/80 hover:text-white hover:border-text-dim transition-all flex items-center gap-2"
                      title="View Tracked Process Logs"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                    </svg>
                    View Logs <span className="bg-white/10 px-1.5 rounded-full text-[9px]">{trackedProcesses.length}</span>
                  </button>

                  {/* Manual Refresh Treemap Button */}
                  <button 
                      onClick={handleRefreshTreemap}
                      className="px-3 py-1 text-xs font-mono font-medium text-text-dim border border-text-dim/30 bg-tech-gray rounded hover:bg-tech-gray/80 hover:text-white hover:border-text-dim transition-all flex items-center gap-2"
                      title="Refresh Treemap Snapshot"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Refresh Map
                  </button>

                  {/* Batch Analyze Button */}
                  <button 
                      onClick={handleBatchAnalyze}
                      disabled={isAnalyzing}
                      className="px-3 py-1 text-xs font-mono font-medium text-neon-blue border border-neon-blue/50 bg-neon-blue/10 rounded hover:bg-neon-blue/20 hover:border-neon-blue hover:shadow-[0_0_10px_rgba(0,255,255,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group"
                      title="Analyze all unanalyzed processes"
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
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 group-hover:animate-pulse">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                        Analyze All
                      </>
                    )}
                  </button>

                  {/* Settings Button */}
                  <button 
                      onClick={() => setIsSettingsOpen(true)}
                      className="p-1.5 text-text-dim hover:text-neon-cyan hover:bg-tech-gray/50 rounded-full border border-transparent hover:border-neon-cyan/30 transition-all duration-300"
                      title="Settings"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.157.921c.441.132.86.324 1.256.551l-.738.674c-.29.266-.356.711-.157 1.056.402.696.885 1.328 1.43 1.884.345.352.883.298 1.15-.078l.61-.856c.25-.349.708-.504 1.127-.37.784.252 1.508.647 2.146 1.164.453.364.57 1.008.3 1.503l-.438.799c-.198.361-.59.574-1.004.576-.759.006-1.488.163-2.152.427-.47.189-.79.624-.79 1.128v1.076c0 .504.32.939.79 1.128.664.264 1.393.421 2.152.427.414.002.806.215 1.004.576l.438.799c.27.495.153 1.139-.3 1.503-.638.517-1.362.912-2.146 1.164-.419-.134-.877.021-1.127-.37l-.61.856c-.267-.376-.805-.43-1.15-.078-.545.556-1.028 1.188-1.43 1.884-.199-.345.133-.79-.157-1.056l-.738.674c-.396.227-.815.419-1.256.551l-.157.921c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.157-.921c-.441-.132-.86-.324-1.256-.551l.738-.674c.29-.266.356-.711.157-1.056-.402-.696-.885-1.328-1.43-1.884-.345-.352-.883-.298-1.15.078l-.61.856c-.25.349-.708.504-1.127.37-.784-.252-1.508-.647-2.146-1.164-.453-.364-.57-1.008-.3-1.503l.438-.799c.198-.361.59-.574 1.004-.576.759-.006 1.488-.163 2.152-.427.47-.189.79-.624.79-1.128V10.5c0-.504-.32-.939-.79-1.128-.664-.264-1.393-.421-2.152-.427-.414-.002-.806-.215-1.004-.576l-.438-.799c-.27-.495-.153-1.139.3-1.503.638-.517 1.362-.912 2.146-1.164.419-.134.877.021 1.127.37l.61.856c.267.376.805.43 1.15.078.545-.556 1.028-1.188 1.43-1.884.199-.345.133-.79-.157-1.056l-.738.674c.396-.227.815-.419 1.256-.551l.157-.921z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
              </div>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <TreemapViz processes={treemapProcesses} onSelect={setSelectedPid} />
          </div>
          <InspectorPane 
              process={selectedProcess} 
              onTrack={handleTrackProcess}
          />
      </div>

      <TrackingModal 
        isOpen={isTrackingModalOpen} 
        onClose={() => setIsTrackingModalOpen(false)} 
        onClear={handleClearTrackedProcesses}
        processes={trackedProcesses} 
      />

      <AnalysisLogsModal
        isOpen={isAnalysisLogsOpen}
        onClose={() => setIsAnalysisLogsOpen(false)}
        onClear={handleClearAnalysisLogs}
        logs={analysisLogs}
      />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

export default App

/**
 * Deduplicate processes by name (case-insensitive)
 * Returns array of unique processes, keeping the first occurrence of each
 */
function deduplicateProcesses(processes: any[]): any[] {
  const seen = new Map<string, any>();
  
  for (const process of processes) {
    const normalizedName = process.name?.toLowerCase() || '';
    if (normalizedName && !seen.has(normalizedName)) {
      seen.set(normalizedName, process);
    }
  }
  
  return Array.from(seen.values());
}
