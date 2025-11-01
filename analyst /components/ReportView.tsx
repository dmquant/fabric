import React, { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import { DownloadIcon, ExportIcon } from './Icons';
import CloudUploadModal from './CloudUploadModal';

declare global {
  interface Window {
    JSZip: any;
  }
}

interface ReportViewProps {
  markdown: string;
  htmlFiles: { name: string; content: string }[];
  htmlBlobUrl: string;
  tasks: Task[];
  symbol: string;
}

type Tab = 'html' | 'markdown' | 'research';

const ReportView: React.FC<ReportViewProps> = ({ markdown, htmlFiles, htmlBlobUrl, tasks, symbol }) => {
  const [activeTab, setActiveTab] = useState<Tab>('html');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  const reportDataRef = useRef({ markdown, htmlFiles, tasks, symbol });
  
  useEffect(() => {
    reportDataRef.current = { markdown, htmlFiles, tasks, symbol };
  }, [markdown, htmlFiles, tasks, symbol]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const generateZipBlob = async (): Promise<Blob> => {
    if (!window.JSZip) {
      throw new Error('JSZip library not found.');
    }
    const { markdown, htmlFiles, tasks, symbol } = reportDataRef.current;
    const zip = new window.JSZip();

    htmlFiles.forEach(file => {
        zip.file(file.name, file.content);
    });
    zip.file("report.md", markdown);

    if(tasks.length > 0) {
      const researchFolder = zip.folder("research_data");
      tasks.forEach((task) => {
        if (task.result) {
          const content = `# Task: ${task.description}\n\n---\n\n${task.result}`;
          const fileId = String(task.id).replace('research-','');
          
          const fileName = task.id === 'fmp-raw-data'
              ? 'fmp_structured_data.md'
              : `task_${fileId}.md`;

          researchFolder!.file(fileName, content);
        }
      });
      
      let logContent = `# Execution Log for ${symbol.toUpperCase()}\n\n`;
      logContent += `This log details the automated research tasks performed, their status, and execution time.\n\n---\n\n`;
      
      // Fix: Explicitly type `taskMap` to resolve type inference issues with nested properties.
      const taskMap: Map<string, Task & { children: Task[] }> = new Map(tasks.map(t => [t.id, { ...t, children: [] as Task[] }]));
      const roots: Task[] = [];
      tasks.forEach(task => {
        if (task.parentId && taskMap.has(task.parentId)) {
          taskMap.get(task.parentId)!.children.push(task);
        } else {
          roots.push(task);
        }
      });
      
      const buildLog = (task: Task, depth: number) => {
        const prefix = '  '.repeat(depth);
        logContent += `${prefix}- **Task:** ${task.description}\n`;
        logContent += `${prefix}  - **Status:** ${task.status.charAt(0).toUpperCase() + task.status.slice(1)}\n`;
        if (task.startTime && task.endTime) {
          const duration = ((task.endTime - task.startTime) / 1000).toFixed(2);
          logContent += `${prefix}  - **Duration:** ${duration} seconds\n`;
        }
        if (task.error) {
          logContent += `${prefix}  - **Error:** ${task.error}\n`;
        }
        logContent += '\n';

        const children = taskMap.get(task.id)?.children || [];
        children.forEach(child => buildLog(child, depth + 1));
      };

      roots.forEach(rootTask => buildLog(rootTask, 0));

      zip.file("execution_log.md", logContent);
    }

    return await zip.generateAsync({ type: "blob" });
  };

  const handleLocalDownload = async () => {
    setIsDownloading(true);
    setIsExportMenuOpen(false);
    try {
      const content = await generateZipBlob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${symbol}_Report.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Failed to generate zip file", error);
      alert(`An error occurred while creating the zip file: ${error instanceof Error ? error.message : ''}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenCloudModal = () => {
    setIsCloudModalOpen(true);
    setIsExportMenuOpen(false);
  };

  // Fix: Use React.FC to explicitly type the component and its props.
  const TabButton: React.FC<{ tabId: Tab, children: React.ReactNode }> = ({ tabId, children }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
        activeTab === tabId
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );

  return (
    <>
      <CloudUploadModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        tasks={tasks}
        symbol={symbol}
        generateZipBlob={generateZipBlob}
      />
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex space-x-2">
            <TabButton tabId="html">HTML Visualization</TabButton>
            <TabButton tabId="markdown">Markdown Report</TabButton>
            {tasks.length > 0 && <TabButton tabId="research">Research Data</TabButton>}
          </div>
          <div className='flex items-center gap-2'>
              {activeTab === 'html' && htmlBlobUrl && (
              <a 
                  href={htmlBlobUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2"
                  >
                  Open in New Tab
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002 2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
              </a>
              )}
              <div className="relative" ref={exportMenuRef}>
                <button 
                    onClick={() => setIsExportMenuOpen(prev => !prev)}
                    disabled={isDownloading}
                    className="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors duration-200 flex items-center gap-2 disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    <ExportIcon className="h-5 w-5"/>
                    {isDownloading ? 'Zipping...' : 'Export Report'}
                </button>

                {isExportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-700 border border-slate-600 rounded-md shadow-lg z-10 p-1 animate-fade-in-down">
                    <button onClick={handleLocalDownload} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-blue-600 rounded-md transition-colors">
                      <DownloadIcon className="h-5 w-5" />
                      <span>Download as .zip</span>
                    </button>
                    <button onClick={handleOpenCloudModal} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-blue-600 rounded-md transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12l2 2m0 0l2-2m-2 2V6" />
                      </svg>
                      <span>Upload to Cloud Fabric</span>
                    </button>
                  </div>
                )}
              </div>
          </div>
        </div>

        <div className="p-2 sm:p-4 max-h-[80vh] overflow-y-auto">
          {activeTab === 'markdown' && (
            <pre className="whitespace-pre-wrap bg-slate-900/50 p-4 rounded-lg text-slate-200 text-sm">
              <code>{markdown}</code>
            </pre>
          )}
          {activeTab === 'html' && htmlBlobUrl && (
            <div className="w-full h-[75vh] bg-white rounded-lg overflow-hidden">
              <iframe
                  src={htmlBlobUrl}
                  title="Financial Report"
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                />
            </div>
          )}
          {activeTab === 'research' && (
              <div className="space-y-4">
                  {tasks.length > 0 ? tasks.filter(t => t.result).map(task => (
                      <details key={task.id} className="bg-slate-900/50 p-4 rounded-lg group">
                          <summary className="font-medium text-slate-200 cursor-pointer list-none flex justify-between items-center">
                              {task.description}
                              <span className="text-slate-400 group-open:rotate-90 transition-transform duration-200">&#x276F;</span>
                          </summary>
                          <div className="mt-4 pt-4 border-t border-slate-700">
                              <pre className="whitespace-pre-wrap text-slate-300 text-sm"><code>{task.result}</code></pre>
                          </div>
                      </details>
                  )) : (
                    <p className="text-slate-400 text-center py-4">No research data available for General mode reports.</p>
                  )}
              </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ReportView;