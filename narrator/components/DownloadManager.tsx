
import React, { useState, useCallback, useEffect } from 'react';
import { useAssets } from '../contexts/AssetContext';
import { useLanguage } from '../contexts/LanguageContext';
import { DownloadIcon, CloudUploadIcon, SpinnerIcon } from './Icons';
import * as fabricService from '../services/fabricService';

declare const JSZip: any;

interface DownloadManagerProps {
    onClose: () => void;
}

type Mode = 'local' | 'fabric';
type Status = 'idle' | 'processing' | 'success' | 'error';

const DownloadManager: React.FC<DownloadManagerProps> = ({ onClose }) => {
    const { assets, logs } = useAssets();
    const { t } = useLanguage();
    const [mode, setMode] = useState<Mode>('local');
    const [status, setStatus] = useState<Status>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [fabricUrl, setFabricUrl] = useState('');
    const [fabricToken, setFabricToken] = useState('');

    useEffect(() => {
        setFabricUrl(localStorage.getItem('fabricUrl') || '');
        setFabricToken(localStorage.getItem('fabricToken') || '');
    }, []);

    const handleFabricUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFabricUrl(e.target.value);
        localStorage.setItem('fabricUrl', e.target.value);
    };

    const handleFabricTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFabricToken(e.target.value);
        localStorage.setItem('fabricToken', e.target.value);
    };

    const createZipBlob = useCallback(async (): Promise<Blob> => {
        const zip = new JSZip();
        
        // Add logs
        const logContent = JSON.stringify(logs, null, 2);
        zip.file('execution_logs.json', logContent);

        // Add assets
        for (const [filename, asset] of assets.entries()) {
            zip.file(filename, asset.data);
        }
        
        return await zip.generateAsync({ type: 'blob' });
    }, [assets, logs]);

    const handleDownloadZip = useCallback(async () => {
        setStatus('processing');
        try {
            const blob = await createZipBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report-assets-${new Date().getTime()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setStatus('success');
            setStatusMessage('Download started successfully.');
        } catch (err) {
            setStatus('error');
            setStatusMessage(err instanceof Error ? err.message : 'Failed to create ZIP file.');
        }
    }, [createZipBlob]);

    const handleUploadToFabric = useCallback(async () => {
        setStatus('processing');
        setStatusMessage('Starting upload process...');
        try {
            const metadata = {
                runId: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                assetCount: assets.size,
                logCount: logs.length,
            };
            setStatusMessage('Creating session...');
            const { sessionId } = await fabricService.createSession(fabricUrl, fabricToken, 'ReportVisualizer', metadata);
            
            setStatusMessage('Uploading logs...');
            await fabricService.appendLogs(fabricUrl, fabricToken, sessionId, logs);

            setStatusMessage('Creating asset package...');
            const zipBlob = await createZipBlob();

            setStatusMessage('Uploading assets...');
            await fabricService.uploadAssets(fabricUrl, fabricToken, sessionId, zipBlob);

            setStatus('success');
            setStatusMessage(`${t('fabricSuccessMessage')} ${sessionId}`);
        } catch (err) {
            setStatus('error');
            setStatusMessage(err instanceof Error ? err.message : 'An unknown error occurred during upload.');
        }
    }, [fabricUrl, fabricToken, logs, assets, createZipBlob, t]);
    
    return (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-full max-w-2xl text-gray-200" onClick={(e) => e.stopPropagation()}>
                <header className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">{t('downloadManagerTitle')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </header>
                
                <div className="p-2 bg-gray-900">
                    <div className="flex bg-gray-700 rounded-lg p-1">
                        <button onClick={() => setMode('local')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'local' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>
                            {t('localZipTab')}
                        </button>
                        <button onClick={() => setMode('fabric')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'fabric' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>
                            {t('fabricTab')}
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {assets.size === 0 ? (
                        <p className="text-center text-gray-400">{t('noAssetsMessage')}</p>
                    ) : (
                        <>
                            {mode === 'local' && (
                                <div>
                                    <p className="text-gray-400 mb-6">{t('localZipDescription')}</p>
                                    <button
                                        onClick={handleDownloadZip}
                                        disabled={status === 'processing'}
                                        className="w-full flex items-center justify-center px-6 py-3 font-bold rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-600 transition-colors"
                                    >
                                        {status === 'processing' ? <SpinnerIcon className="w-5 h-5 mr-2 animate-spin"/> : <DownloadIcon className="w-5 h-5 mr-2" />}
                                        {status === 'processing' ? t('downloadingZipButton') : t('downloadZipButton')}
                                    </button>
                                </div>
                            )}
                            {mode === 'fabric' && (
                                <div className="space-y-4">
                                    <p className="text-gray-400 mb-2">{t('fabricDescription')}</p>
                                    <div>
                                        <label htmlFor="fabric-url" className="block text-sm font-medium text-gray-300 mb-1">{t('fabricUrlLabel')}</label>
                                        <input
                                            type="url"
                                            id="fabric-url"
                                            value={fabricUrl}
                                            onChange={handleFabricUrlChange}
                                            placeholder="https://your-worker.workers.dev"
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="fabric-token" className="block text-sm font-medium text-gray-300 mb-1">{t('fabricTokenLabel')}</label>
                                        <input
                                            type="password"
                                            id="fabric-token"
                                            value={fabricToken}
                                            onChange={handleFabricTokenChange}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        />
                                    </div>
                                    <button
                                        onClick={handleUploadToFabric}
                                        disabled={status === 'processing' || !fabricUrl || !fabricToken}
                                        className="w-full flex items-center justify-center px-6 py-3 font-bold rounded-md bg-purple-600 text-white hover:bg-purple-500 disabled:bg-gray-600 transition-colors"
                                    >
                                        {status === 'processing' ? <SpinnerIcon className="w-5 h-5 mr-2 animate-spin"/> : <CloudUploadIcon className="w-5 h-5 mr-2" />}
                                        {status === 'processing' ? t('uploadingToFabricButton') : t('uploadToFabricButton')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
                
                {status !== 'idle' && (
                    <footer className="p-4 border-t border-gray-700 bg-gray-900/50 text-sm">
                        {status === 'processing' && <p className="text-yellow-400">{statusMessage || 'Processing...'}</p>}
                        {status === 'success' && <p className="text-green-400">{statusMessage}</p>}
                        {status === 'error' && <p className="text-red-400">{statusMessage}</p>}
                    </footer>
                )}
            </div>
        </div>
    );
};

export default DownloadManager;
