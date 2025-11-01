
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Task, ReportData, TaskStatus } from './types';
import * as GeminiService from './services/gemini';
import * as FMPService from './services/fmp';
import ExecutionFlow from './components/ExecutionFlow';
import ReportView from './components/ReportView';
import FmpApiKeyModal from './components/FmpApiKeyModal';
import ToggleSwitch from './components/ToggleSwitch';
import { SearchIcon, LoadingIcon, ErrorIcon } from './components/Icons';
import { FMP_TASKS } from './constants';

type ResearchMode = 'deep' | 'general';

// Custom error class to propagate task failure details
class TaskExecutionError extends Error {
  constructor(message: string, public taskDescription: string) {
    super(message);
    this.name = 'TaskExecutionError';
  }
}

const App: React.FC = () => {
  const [symbol, setSymbol] = useState('');
  const [researchMode, setResearchMode] = useState<ResearchMode>('deep');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [htmlBlobUrl, setHtmlBlobUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fmpKey, setFmpKey] = useState<string | null>(null);

  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const [useFmp, setUseFmp] = useState(true);
  const [isFmpModalOpen, setIsFmpModalOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<{ symbol: string; tasks?: Task[] } | null>(null);

  useEffect(() => {
    return () => {
      if (htmlBlobUrl) {
        URL.revokeObjectURL(htmlBlobUrl);
      }
    };
  }, [htmlBlobUrl]);

  const addTasks = useCallback((newTasks: Omit<Task, 'status' | 'result' | 'error'>[]) => {
    setTasks(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const tasksToAdd = newTasks
        .filter(t => !existingIds.has(t.id))
        .map(t => ({
          ...t,
          status: 'pending' as TaskStatus,
          result: null,
          error: null,
        }));
      return [...prev, ...tasksToAdd];
    });
  }, []);

  const updateTask = useCallback((taskId: string, status: TaskStatus, data: Partial<Omit<Task, 'id' | 'description' | 'type' | 'parentId'>> = {}) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, status, ...data } : task
      )
    );
  }, []);

  const handleFmpDeepDive = useCallback(async (stockSymbol: string, apiKey: string, rootId: string): Promise<{ markdown: string, htmlFiles: { name: string; content: string }[] }> => {
    // --- Step 1: Gather Financial Data ---
    const fmpParentTaskId = 'fmp-data';
    let fmpDataString: string | undefined;

    const fmpDataTask = tasksRef.current.find(t => t.id === 'fmp-raw-data');
    if (fmpDataTask?.status === 'completed' && fmpDataTask.result) {
        fmpDataString = fmpDataTask.result;
    } else {
        addTasks([{ id: fmpParentTaskId, parentId: rootId, description: 'Gathering Financial Data', type: 'meta' }]);
        updateTask(fmpParentTaskId, 'running', { startTime: Date.now() });

        const fmpSubTasks: Omit<Task, 'status'|'result'|'error'>[] = FMP_TASKS.map(t => ({ ...t, parentId: fmpParentTaskId, type: 'data-gathering' }));
        addTasks(fmpSubTasks);
        fmpSubTasks.forEach(t => updateTask(t.id, 'running'));
        
        try {
            fmpDataString = await FMPService.fetchAllFmpData(stockSymbol, apiKey);
            updateTask(fmpParentTaskId, 'completed', { endTime: Date.now() });
            fmpSubTasks.forEach(t => updateTask(t.id, 'completed', { endTime: Date.now() }));
            const fmpDataHolderTask: Omit<Task, 'status'|'result'|'error'> = { id: 'fmp-raw-data', parentId: fmpParentTaskId, type: 'data-gathering', description: 'Raw Financial Data from FMP API' };
            addTasks([fmpDataHolderTask]);
            updateTask(fmpDataHolderTask.id, 'completed', { result: fmpDataString });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown FMP error occurred.';
            updateTask(fmpParentTaskId, 'failed', { error: errorMessage, endTime: Date.now() });
            fmpSubTasks.forEach(t => updateTask(t.id, 'failed', { error: errorMessage, endTime: Date.now() }));
            throw new TaskExecutionError(errorMessage, 'Gathering Financial Data');
        }
    }

    // --- Step 2: Generate Research Plan ---
    const planTaskId = 'planning';
    let planTasks: { description: string }[];
    
    const planTaskInState = tasksRef.current.find(t => t.id === planTaskId);
    if (planTaskInState?.status === 'completed' && planTaskInState.result) {
        planTasks = JSON.parse(planTaskInState.result);
    } else {
        addTasks([{ id: planTaskId, parentId: rootId, description: 'Generating Smart Research Plan', type: 'meta' }]);
        updateTask(planTaskId, 'running', { startTime: Date.now() });
        try {
            planTasks = await GeminiService.generatePlan(stockSymbol, fmpDataString);
            updateTask(planTaskId, 'completed', { result: JSON.stringify(planTasks), endTime: Date.now() });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            updateTask(planTaskId, 'failed', { error: errorMsg, endTime: Date.now() });
            throw new TaskExecutionError(errorMsg, 'Generating Smart Research Plan');
        }
    }

    // --- Step 3: Execute Web Research ---
    const researchParentTaskId = 'web-research';
    const completedResearchForReport: Task[] = tasksRef.current.filter(t => t.type === 'research' && t.status === 'completed');

    const researchParentTask = tasksRef.current.find(t => t.id === researchParentTaskId);
    if (researchParentTask?.status !== 'completed') {
        addTasks([{ id: researchParentTaskId, parentId: rootId, description: 'Executing Web Research', type: 'meta' }]);
        updateTask(researchParentTaskId, 'running', {startTime: Date.now()});
        
        const researchTasksToRun: Omit<Task, 'status'|'result'|'error'>[] = planTasks.map((task: any, index: number) => ({ id: `research-${index}`, parentId: researchParentTaskId, description: task.description, type: 'research' }));
        addTasks(researchTasksToRun);

        for (const task of researchTasksToRun) {
            // Check if this specific task is already completed (from a previous partial run)
            if (tasksRef.current.find(t => t.id === task.id)?.status === 'completed') continue;
            
            try {
                updateTask(task.id, 'running', { startTime: Date.now() });
                // Pass fmpDataString to the research execution
                const result = await GeminiService.executeResearch(task.description, stockSymbol, fmpDataString);
                const completedTask: Task = {
                    id: task.id,
                    parentId: task.parentId,
                    description: task.description,
                    type: 'research',
                    status: 'completed',
                    result: result,
                    error: null,
                };
                completedResearchForReport.push(completedTask);
                updateTask(task.id, 'completed', { result, endTime: Date.now() });
            } catch (researchError) {
                const errorMessage = researchError instanceof Error ? researchError.message : 'An unknown error occurred';
                updateTask(task.id, 'failed', { error: errorMessage, endTime: Date.now() });
                updateTask(researchParentTaskId, 'failed', { error: `Sub-task '${task.description}' failed.`, endTime: Date.now() });
                throw new TaskExecutionError(errorMessage, task.description);
            }
        }
        updateTask(researchParentTaskId, 'completed', {endTime: Date.now()});
    }

    if (completedResearchForReport.length === 0) {
        const errorMsg = "No web research tasks were completed successfully. Cannot generate a report.";
        updateTask(researchParentTaskId, 'failed', { error: errorMsg, endTime: Date.now() });
        throw new TaskExecutionError(errorMsg, 'Executing Web Research');
    }

    // --- Step 4: Compose Report ---
    const composeTaskId = 'composing';
    let markdown: string;

    const composeTaskInState = tasksRef.current.find(t => t.id === composeTaskId);
    if (composeTaskInState?.status === 'completed' && composeTaskInState.result) {
        markdown = composeTaskInState.result;
    } else {
        addTasks([{ id: composeTaskId, parentId: rootId, description: 'Composing Final Report', type: 'meta' }]);
        updateTask(composeTaskId, 'running', { startTime: Date.now() });
        try {
            markdown = await GeminiService.composeReport(completedResearchForReport, stockSymbol, fmpDataString);
            if (!markdown) {
                throw new Error("Composing step produced an empty report.");
            }
            updateTask(composeTaskId, 'completed', { result: markdown, endTime: Date.now() });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            updateTask(composeTaskId, 'failed', { error: errorMsg, endTime: Date.now() });
            throw new TaskExecutionError(errorMsg, 'Composing Final Report');
        }
    }
    
    // --- Step 5: Create Visualization ---
    const visualizeTaskId = 'visualizing';
    let htmlFiles: { name: string; content: string }[];
    
    const visualizeTaskInState = tasksRef.current.find(t => t.id === visualizeTaskId);
    if(visualizeTaskInState?.status === 'completed' && visualizeTaskInState.result) {
        htmlFiles = JSON.parse(visualizeTaskInState.result);
    } else {
        addTasks([{ id: visualizeTaskId, parentId: rootId, description: 'Creating Interactive Visualization', type: 'meta' }]);
        updateTask(visualizeTaskId, 'running', { startTime: Date.now() });
        try {
            htmlFiles = await GeminiService.createVisualizationPackage(markdown, stockSymbol, tasksRef.current);
            updateTask(visualizeTaskId, 'completed', { result: JSON.stringify(htmlFiles), endTime: Date.now() });
        } catch(e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            updateTask(visualizeTaskId, 'failed', { error: errorMsg, endTime: Date.now() });
            throw new TaskExecutionError(errorMsg, 'Creating Interactive Visualization');
        }
    }
    
    // --- Step 6: Return final result ---
    return { markdown, htmlFiles };
  }, [addTasks, updateTask]);

  const handleGeneralMode = useCallback(async (stockSymbol: string, rootId: string, apiKey: string): Promise<{ markdown: string, htmlFiles: { name: string; content: string }[] }> => {
    let fmpDataString: string | undefined;

    // --- Step 1: Gather Financial Data (if enabled) ---
    if (useFmp) {
      const fmpParentTaskId = 'fmp-data-general';
      const fmpDataTask = tasksRef.current.find(t => t.id === 'fmp-raw-data-general');
      
      if (fmpDataTask?.status === 'completed' && fmpDataTask.result) {
        fmpDataString = fmpDataTask.result;
      } else {
        addTasks([{ id: fmpParentTaskId, parentId: rootId, description: 'Gathering Financial Data', type: 'meta' }]);
        updateTask(fmpParentTaskId, 'running', { startTime: Date.now() });
        
        try {
          fmpDataString = await FMPService.fetchAllFmpData(stockSymbol, apiKey);
          updateTask(fmpParentTaskId, 'completed', { endTime: Date.now() });
          
          const fmpDataHolderTask: Omit<Task, 'status'|'result'|'error'> = { id: 'fmp-raw-data-general', parentId: fmpParentTaskId, type: 'data-gathering', description: 'Raw Financial Data from FMP API' };
          addTasks([fmpDataHolderTask]);
          updateTask(fmpDataHolderTask.id, 'completed', { result: fmpDataString });
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'An unknown FMP error occurred.';
          updateTask(fmpParentTaskId, 'failed', { error: errorMessage, endTime: Date.now() });
          throw new TaskExecutionError(errorMessage, 'Gathering Financial Data');
        }
      }
    }

    // --- Step 2: Perform General Analysis ---
    const researchTaskId = 'general-research';
    let markdown: string;

    const researchTaskInState = tasksRef.current.find(t => t.id === researchTaskId);
    if (researchTaskInState?.status === 'completed' && researchTaskInState.result) {
        markdown = researchTaskInState.result;
    } else {
        addTasks([{ id: researchTaskId, parentId: rootId, description: 'Performing General Stock Analysis', type: 'meta' }]);
        updateTask(researchTaskId, 'running', { startTime: Date.now() });
        try {
            markdown = await GeminiService.executeGeneralResearch(stockSymbol, fmpDataString);
            if(!markdown) throw new Error("General analysis produced an empty report.");
            updateTask(researchTaskId, 'completed', { result: markdown, endTime: Date.now() });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            updateTask(researchTaskId, 'failed', { error: errorMsg, endTime: Date.now() });
            throw new TaskExecutionError(errorMsg, 'Performing General Stock Analysis');
        }
    }

    // --- Step 3: Create Visualization ---
    const visualizeTaskId = 'visualizing-general';
    let htmlFiles: { name: string; content: string }[];

    const visualizeTaskInState = tasksRef.current.find(t => t.id === visualizeTaskId);
    if (visualizeTaskInState?.status === 'completed' && visualizeTaskInState.result) {
        htmlFiles = JSON.parse(visualizeTaskInState.result);
    } else {
        addTasks([{ id: visualizeTaskId, parentId: rootId, description: 'Creating Interactive Visualization', type: 'meta' }]);
        updateTask(visualizeTaskId, 'running', { startTime: Date.now() });
        try {
            htmlFiles = await GeminiService.createVisualizationPackage(markdown, stockSymbol);
            updateTask(visualizeTaskId, 'completed', { result: JSON.stringify(htmlFiles), endTime: Date.now() });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            updateTask(visualizeTaskId, 'failed', { error: errorMsg, endTime: Date.now() });
            throw new TaskExecutionError(errorMsg, 'Creating Interactive Visualization');
        }
    }
    
    return { markdown, htmlFiles };
  }, [addTasks, updateTask, useFmp]);

  const handleGenerateReport = useCallback(async (symbolOverride?: string, apiKey?: string, existingTasks?: Task[]) => {
    const stockSymbol = (symbolOverride || symbol).trim();
    if (!stockSymbol) {
      setError('Please enter a stock symbol.');
      return;
    }

    if (useFmp && !apiKey) {
      setPendingRequest({ symbol: stockSymbol, tasks: existingTasks });
      setIsFmpModalOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    if (!existingTasks) {
      setReport(null);
      if (htmlBlobUrl) URL.revokeObjectURL(htmlBlobUrl);
      setHtmlBlobUrl('');
      const newRootTaskId = `root-${Date.now()}`;
      const rootTask: Task = { id: newRootTaskId, parentId: null, type: 'meta', description: `Financial Analysis for ${stockSymbol}`, status: 'running', result: null, error: null, startTime: Date.now() };
      setTasks([rootTask]);
    } else {
      setTasks(existingTasks);
    }

    try {
      // We need to wait for state to update before proceeding
      await new Promise(resolve => setTimeout(resolve, 0));
      const currentTasks = tasksRef.current;
      const rootTask = currentTasks.find(t => t.parentId === null);
      if (!rootTask) throw new Error("Root task not found.");

      let result;
      if (researchMode === 'deep') {
        result = useFmp
          ? await handleFmpDeepDive(stockSymbol, apiKey!, rootTask.id)
          : null; // Placeholder for standard deep dive
      } else {
        // General mode now also supports resume and has structured steps
        result = await handleGeneralMode(stockSymbol, rootTask.id, apiKey!);
      }
      
      if (result) {
        const { markdown, htmlFiles } = result;
        const mainFile = htmlFiles.find(f => f.name === 'index.html' || f.name === 'report.html');
        if (!mainFile) throw new Error("Visualization package is missing the main HTML file.");
        
        const blob = new Blob([mainFile.content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setHtmlBlobUrl(url);
        setReport({ markdown, htmlFiles });
        updateTask(rootTask.id, 'completed', { endTime: Date.now() });
      } else if (!useFmp && researchMode === 'deep') {
          throw new TaskExecutionError("Deep Dive without FMP data is not supported in this version.", "Data Gathering");
      }
      // Failures are now handled by the catch block

    } catch (e) {
      const rootTask = tasksRef.current.find(t => t.parentId === null);

      if (e instanceof TaskExecutionError) {
        const rootError = `Process failed at step: ${e.taskDescription}. See details below.`;
        if (rootTask) updateTask(rootTask.id, 'failed', { error: rootError, endTime: Date.now() });
        setError(rootError);
      } else {
        const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
        if(rootTask) updateTask(rootTask.id, 'failed', { error: errorMessage, endTime: Date.now() });
        
        if (errorMessage.toLowerCase().includes('invalid api key')) {
          setPendingRequest({ symbol: stockSymbol });
          setError('Your FMP API Key is invalid. Please enter a valid key to proceed.');
          setIsFmpModalOpen(true);
        } else {
          console.error(errorMessage, e);
          setError(errorMessage);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [symbol, htmlBlobUrl, researchMode, useFmp, handleFmpDeepDive, updateTask, handleGeneralMode]);
  
  const handleFmpKeySave = (key: string) => {
    setFmpKey(key);
    setIsFmpModalOpen(false);
    if (pendingRequest) {
      handleGenerateReport(pendingRequest.symbol, key, pendingRequest.tasks);
      setPendingRequest(null);
    }
  };

  const handleRetry = () => {
    const failedTaskIndex = tasks.findIndex(t => t.status === 'failed');
    if (failedTaskIndex === -1) return;

    const newTasks = tasks.map((task, index) => {
      if (index >= failedTaskIndex) {
        return {
          ...task,
          status: 'pending' as TaskStatus,
          result: null,
          error: null,
          startTime: undefined,
          endTime: undefined,
        };
      }
      return task;
    });
    handleGenerateReport(symbol, fmpKey!, newTasks);
  };

  const isProcessing = isLoading;
  const hasFailed = tasks.some(t => t.status === 'failed');

  return (
    <div className="bg-slate-900 text-white min-h-screen font-sans">
      <main className="container mx-auto px-4 py-8 sm:py-16">
        <FmpApiKeyModal isOpen={isFmpModalOpen} onClose={() => { setIsFmpModalOpen(false); setPendingRequest(null); }} onSave={handleFmpKeySave} isPendingAnalysis={!!pendingRequest} />

        <header className="text-center mb-10 sm:mb-16 animate-fade-in-down">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            AI Financial Analyst
          </h1>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Enter a stock symbol to generate a comprehensive financial report using generative AI.
          </p>
        </header>

        <section className="max-w-2xl mx-auto">
          <div className="relative">
            <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="e.g., NVDA, AAPL, TSLA" disabled={isLoading} onKeyUp={(e) => e.key === 'Enter' && handleGenerateReport()} className="w-full pl-5 pr-32 py-4 text-lg bg-slate-800 border-2 border-slate-700 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-300 disabled:opacity-50" />
            <button onClick={() => handleGenerateReport()} disabled={isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-2">
              {isLoading ? (<><LoadingIcon className="h-5 w-5 animate-spin" /><span>Generating...</span></>) : (<><SearchIcon className="h-5 w-5" /><span>Analyze</span></>)}
            </button>
          </div>
          
          <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
            <div className="flex justify-center items-center gap-2 bg-slate-800 p-1 rounded-full border border-slate-700 w-fit mx-auto">
              {(['deep', 'general'] as ResearchMode[]).map((mode) => (
                <button key={mode} onClick={() => setResearchMode(mode)} disabled={isLoading} className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 ${researchMode === mode ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                  {mode === 'deep' ? 'Deep Dive' : 'General'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 animate-fade-in">
              <ToggleSwitch label="Use FMP Data" enabled={useFmp} onChange={setUseFmp} disabled={isLoading} />
            </div>
          </div>

           {error && !isFmpModalOpen && (
            <div className="mt-4 flex items-center justify-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-lg animate-fade-in">
              <ErrorIcon className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {(isProcessing || tasks.length > 0) && (
           <section className="mt-12 max-w-full mx-auto">
             <ExecutionFlow tasks={tasks} onRetry={handleRetry} />
           </section>
        )}
        
        {report && !isProcessing && !hasFailed && (
          <section className="mt-12 max-w-7xl mx-auto">
            <ReportView markdown={report.markdown} htmlFiles={report.htmlFiles} htmlBlobUrl={htmlBlobUrl} tasks={tasksRef.current} symbol={symbol} />
          </section>
        )}
      </main>
      <footer className="text-center py-6 text-slate-500 text-sm">
        <p>Powered by Google Gemini & Financial Modeling Prep API</p>
      </footer>
    </div>
  );
};

export default App;
