import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import * as FabricService from '../services/fabric';
import { LoadingIcon, CheckCircleIcon, XCircleIcon } from './Icons';

interface CloudUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  symbol: string;
  generateZipBlob: () => Promise<Blob>;
}

type UploadStatus = 'idle' | 'creating_session' | 'uploading_logs' | 'uploading_assets' | 'completed' | 'failed';

const CloudUploadModal: React.FC<CloudUploadModalProps> = ({ isOpen, onClose, tasks, symbol, generateZipBlob }) => {
  const [workerUrl, setWorkerUrl] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setWorkerUrl(localStorage.getItem('fabric_worker_url') || '');
      setToken(localStorage.getItem('fabric_token') || '');
      setStatus('idle');
      setError(null);
      setSessionId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isUploading = status !== 'idle' && status !== 'completed' && status !== 'failed';

  const handleUpload = async () => {
    if (!workerUrl || !token) {
      setError('Worker URL and Token are required.');
      return;
    }
    setError(null);
    localStorage.setItem('fabric_worker_url', workerUrl);
    localStorage.setItem('fabric_token', token);

    try {
      // 1. Create Session
      setStatus('creating_session');
      const rootTask = tasks.find(t => t.parentId === null);
      const session = await FabricService.createSession(workerUrl, token, 'Gemini Analyst', {
        runId: rootTask?.id || `run_${Date.now()}`,
        inputSummary: `Financial Analysis for ${symbol.toUpperCase()}`
      });
      setSessionId(session.sessionId);

      // 2. Upload Logs
      setStatus('uploading_logs');
      const logEntries = FabricService.tasksToLogEntries(tasks);
      if (logEntries.length > 0) {
        await FabricService.appendLogs(workerUrl, token, session.sessionId, logEntries);
      }
      
      // 3. Upload Assets
      setStatus('uploading_assets');
      const zipBlob = await generateZipBlob();
      await FabricService.uploadAssets(workerUrl, token, session.sessionId, zipBlob);

      setStatus('completed');

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error("Fabric upload failed:", e);
      setError(errorMessage);
      setStatus('failed');
    }
  };

  const getStatusContent = () => {
    switch (status) {
      case 'creating_session':
        return <><LoadingIcon className="h-5 w-5 animate-spin" /><span>Step 1/3: Creating session...</span></>;
      case 'uploading_logs':
        return <><LoadingIcon className="h-5 w-5 animate-spin" /><span>Step 2/3: Uploading execution logs...</span></>;
      case 'uploading_assets':
        return <><LoadingIcon className="h-5 w-5 animate-spin" /><span>Step 3/3: Uploading report assets (.zip)...</span></>;
      case 'completed':
        return <><CheckCircleIcon className="h-5 w-5 text-green-400" /><span>Upload complete! Session ID: {sessionId}</span></>;
      case 'failed':
        return <><XCircleIcon className="h-5 w-5 text-red-400" /><span>Upload failed: {error}</span></>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-4 text-white">Upload to Fabric Worker</h2>
        <p className="text-slate-400 mb-6">
          Enter your Fabric Worker URL and bearer token to upload the session logs and report assets. Credentials are saved in your browser's local storage.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="fabric-url" className="block text-sm font-medium text-slate-300 mb-2">Worker URL</label>
            <input id="fabric-url" type="text" value={workerUrl} onChange={(e) => setWorkerUrl(e.target.value)} placeholder="https://your-worker.workers.dev" disabled={isUploading} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50"/>
          </div>
          <div>
            <label htmlFor="fabric-token" className="block text-sm font-medium text-slate-300 mb-2">Fabric Token</label>
            <input id="fabric-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Enter your bearer token" disabled={isUploading} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50"/>
          </div>
        </div>

        { (status !== 'idle') && (
            <div className="mt-6 p-3 bg-slate-900/50 rounded-lg flex items-center justify-center gap-3 text-slate-200">
                {getStatusContent()}
            </div>
        )}
        
        <div className="mt-8 flex justify-end space-x-4">
          <button onClick={onClose} disabled={isUploading} className="px-6 py-2 text-sm font-semibold text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-slate-500 disabled:opacity-50">
            {status === 'completed' ? 'Close' : 'Cancel'}
          </button>
          <button onClick={handleUpload} disabled={isUploading || !workerUrl.trim() || !token.trim()} className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-2">
            {isUploading ? <><LoadingIcon className="h-5 w-5 animate-spin"/> Uploading...</> : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloudUploadModal;
