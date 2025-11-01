
import React, { useMemo } from 'react';
import { Task } from '../types';
import { LoadingIcon, CheckCircleIcon, XCircleIcon, PendingIcon, DownloadIcon, ArrowRightIcon, RetryIcon } from './Icons';

interface ExecutionFlowProps {
  tasks: Task[];
  onRetry: () => void;
}

const getStatusIcon = (status: Task['status']) => {
  switch (status) {
    case 'running':
      return <LoadingIcon className="h-6 w-6 text-blue-400 animate-spin" />;
    case 'completed':
      return <CheckCircleIcon className="h-6 w-6 text-green-400" />;
    case 'failed':
      return <XCircleIcon className="h-6 w-6 text-red-400" />;
    case 'pending':
    default:
      return <PendingIcon className="h-6 w-6 text-slate-500" />;
  }
};

const TaskNode: React.FC<{ task: Task; onRetry: () => void }> = ({ task, onRetry }) => {
  const handleDownload = () => {
    if (!task.result) return;
    const blob = new Blob([task.result], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const sanitizedDesc = task.description.toLowerCase().replace(/[\s\W]+/g, '_').substring(0, 30);
    link.download = `task_result_${sanitizedDesc}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };
  
  return (
    <div className="bg-slate-200 text-slate-800 rounded-lg shadow-md p-3 w-64 min-h-[80px] flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:scale-105">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-1 text-slate-600">
            {getStatusIcon(task.status)}
        </div>
        <div>
            <p className="text-sm font-semibold">{task.description}</p>
            {task.error && <p className="text-xs text-red-600 mt-1">{task.error}</p>}
        </div>
      </div>
       <div className="flex justify-end items-center gap-2 mt-2 h-8">
        {task.startTime && task.endTime && (
          <span className="text-xs font-mono bg-slate-300 text-slate-600 px-2 py-0.5 rounded">
            {((task.endTime - task.startTime) / 1000).toFixed(2)}s
          </span>
        )}
        {task.result && task.status === 'completed' && (
          <button onClick={handleDownload} title="Download task result" className="text-slate-500 hover:text-blue-600 transition-colors">
            <DownloadIcon className="h-5 w-5" />
          </button>
        )}
        {task.status === 'failed' && (
          <button onClick={onRetry} title="Retry failed task" className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors">
            <RetryIcon className="h-4 w-4" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

interface Stage {
    id: string;
    metaTask: Task;
    children: Task[];
}

const ExecutionFlow: React.FC<ExecutionFlowProps> = ({ tasks, onRetry }) => {
  const stages = useMemo<Stage[]>(() => {
    if (!tasks || tasks.length === 0) return [];
    
    const root = tasks.find(t => t.parentId === null);
    if (!root) return [];
    
    const metaTasks = tasks.filter(t => t.type === 'meta' && t.parentId === root.id);
    
    const stageMap = new Map<string, Stage>(metaTasks.map(meta => [
      meta.id,
      {
        id: meta.id,
        metaTask: meta,
        children: tasks.filter(t => t.parentId === meta.id),
      }
    ]));
    
    const orderedStageIds = [
      'fmp-data', 'planning', 'web-research', 'composing', 'visualizing',
      'fmp-data-general', 'general-research', 'visualizing-general'
    ];
    
    const result: Stage[] = [];
    orderedStageIds.forEach(id => {
      if(stageMap.has(id)) {
        result.push(stageMap.get(id)!);
      }
    });

    return result;
  }, [tasks]);

  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 animate-fade-in">
      <h2 className="text-xl font-bold mb-6 text-white text-center">Execution Flow</h2>
      <div className="flex items-start gap-4 lg:gap-8 p-4 overflow-x-auto">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.id}>
            <div className="flex flex-col items-center flex-shrink-0">
              {/* Stage Parent Task */}
              <div className="text-center">
                 <h3 className="text-sm font-semibold text-slate-300 tracking-wider uppercase mb-3 h-8 flex items-center justify-center">{stage.metaTask.description}</h3>
                 <TaskNode task={stage.metaTask} onRetry={onRetry} />
              </div>
              
              {/* Children tasks, if any */}
              {stage.children.length > 0 && (
                <div className="flex flex-col items-center mt-4">
                  {/* Vertical line connecting parent to children group */}
                  <div className="w-px h-4 bg-slate-600" />
                  
                  <div className="flex flex-col gap-3 p-4 border border-slate-700 rounded-lg bg-slate-900/50 relative">
                     {/* Connector hook from line to group box */}
                    <div className="absolute top-[-17px] left-1/2 -translate-x-1/2 w-px h-4 bg-slate-600" />
                    {stage.children.map((child) => (
                      <TaskNode key={child.id} task={child} onRetry={onRetry} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Arrow connecting stages */}
            {index < stages.length - 1 && (
              <div className="flex-shrink-0" style={{ paddingTop: '68px' }}>
                <ArrowRightIcon className="h-8 w-8 text-slate-600" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ExecutionFlow;
