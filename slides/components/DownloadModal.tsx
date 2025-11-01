import React, { useState } from 'react';
import { bootstrapScript } from './bootstrap';
import { CloseIcon, CloudUploadIcon, DownloadIcon, LoadingSpinner } from './icons';

declare const JSZip: any;

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    code: { html: string; css: string; js: string };
    logs: any[];
    narrationScripts: string[];
    audioBlobs: Blob[];
}

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const pcmToWavBlob = (pcmData: ArrayBuffer): Blob => {
  const sampleRate = 24000; // Gemini TTS sample rate
  const numChannels = 1;
  const bitsPerSample = 16;
  
  const dataSize = pcmData.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // byte rate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); // block align
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM data
  const pcmBytes = new Uint8Array(pcmData);
  for (let i = 0; i < pcmBytes.length; i++) {
    view.setUint8(44 + i, pcmBytes[i]);
  }

  return new Blob([view], { type: 'audio/wav' });
};

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose, code, logs, narrationScripts, audioBlobs }) => {
    const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local');
    
    const [workerUrl, setWorkerUrl] = useState('');
    const [workerToken, setWorkerToken] = useState('');
    const [uploadStatus, setUploadStatus] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const getFullHtml = (currentCode: { html: string; css: string; js: string }, forExport = false) => {
        const cssLink = forExport ? '<link rel="stylesheet" href="style.css">' : `<style>${currentCode.css}</style>`;
        const jsScript = forExport ? '<script src="script.js" defer></script>' : `<script>${bootstrapScript}${currentCode.js}</script>`;
    
        return `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Presentation</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.0/chart.min.js"></script>
              <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
              ${cssLink}
            </head>
            <body>
              ${currentCode.html}
              ${jsScript}
            </body>
          </html>
        `;
    };

    const createZip = async () => {
        const zip = new JSZip();
        const finalHtml = getFullHtml(code, true);
        const finalJs = `${bootstrapScript}\n\n${code.js}`;
    
        zip.file("index.html", finalHtml);
        zip.file("style.css", code.css);
        zip.file("script.js", finalJs);
        zip.file("gemini_logs.json", JSON.stringify(logs, null, 2));

        if (narrationScripts.length > 0) {
            zip.file("narration_scripts.json", JSON.stringify(narrationScripts, null, 2));
        }
        if (audioBlobs.length > 0) {
            const audioFolder = zip.folder("audio");
            const wavPromises = audioBlobs.map(async (blob, index) => {
                const pcmData = await blob.arrayBuffer();
                const wavBlob = pcmToWavBlob(pcmData);
                audioFolder!.file(`slide_${index + 1}_narration.wav`, wavBlob);
            });
            await Promise.all(wavPromises);
        }

        return zip;
    }

    const handleLocalDownload = async () => {
        const zip = await createZip();
        zip.generateAsync({ type: "blob" }).then((content: any) => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = "presentation.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };
    
    const handleCloudUpload = async () => {
        setIsUploading(true);
        setError('');
        setUploadStatus('Starting upload...');
        
        try {
            // 1. Create Session
            setUploadStatus('Creating session...');
            const sessionResponse = await fetch(`${workerUrl}/sessions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${workerToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    appName: "Gemini Slides Visual Editor",
                    metadata: {
                      runId: crypto.randomUUID(),
                      inputSummary: "Presentation generated via Gemini AI"
                    }
                })
            });

            if (sessionResponse.status !== 201) {
                const errorBody = await sessionResponse.text();
                throw new Error(`Failed to create session: ${sessionResponse.status} ${errorBody}`);
            }
            const { sessionId } = await sessionResponse.json();

            // 2. Stream Logs
            setUploadStatus('Uploading logs...');
            const logEntries = logs.map(log => ({
                level: log.type === 'error' ? 'error' : 'info',
                message: log.type === 'prompt' ? 'User Prompt' : log.content,
                context: log.type === 'prompt' ? { prompt: log.content } : {}
            }));
            
            if (logEntries.length > 0) {
                const logsResponse = await fetch(`${workerUrl}/sessions/${sessionId}/logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${workerToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ entries: logEntries })
                });
                if (!logsResponse.ok) {
                    const errorBody = await logsResponse.text();
                    throw new Error(`Failed to upload logs: ${logsResponse.status} ${errorBody}`);
                }
            }

            // 3. Upload Assets
            setUploadStatus('Packaging assets...');
            const zip = await createZip();
            const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
            
            setUploadStatus('Uploading assets...');
            const assetsResponse = await fetch(`${workerUrl}/sessions/${sessionId}/assets`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${workerToken}`,
                    'Content-Type': 'application/zip'
                },
                body: zipBlob
            });
            if (!assetsResponse.ok) {
                const errorBody = await assetsResponse.text();
                throw new Error(`Failed to upload assets: ${assetsResponse.status} ${errorBody}`);
            }

            setUploadStatus('Upload complete!');

        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setUploadStatus('Upload failed.');
        } finally {
            setIsUploading(false);
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg text-white transform transition-all" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Export Presentation</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><CloseIcon /></button>
                </div>

                <div className="p-2 bg-gray-900/50">
                    <div className="flex border-b border-gray-700">
                        <button onClick={() => setActiveTab('local')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'local' ? 'border-b-2 border-purple-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                            Local Download
                        </button>
                        <button onClick={() => setActiveTab('cloud')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'cloud' ? 'border-b-2 border-purple-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                            Cloud Upload
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {activeTab === 'local' && (
                        <div>
                            <p className="text-gray-300 mb-4">Download all presentation files as a single ZIP archive.</p>
                            <ul className="text-sm text-gray-400 list-disc list-inside mb-6 space-y-1">
                                <li>index.html</li>
                                <li>style.css</li>
                                <li>script.js</li>
                                <li>gemini_logs.json</li>
                                {narrationScripts.length > 0 && <li>narration_scripts.json</li>}
                                {audioBlobs.length > 0 && <li>/audio/*.wav</li>}
                            </ul>
                            <button onClick={handleLocalDownload} className="w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md transition-colors duration-200">
                                <DownloadIcon />
                                <span className="ml-2">Download .zip</span>
                            </button>
                        </div>
                    )}
                    {activeTab === 'cloud' && (
                        <div>
                            <p className="text-gray-300 mb-4">Upload presentation assets to a Fabric Worker for storage.</p>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="worker-url" className="block text-sm font-medium text-gray-300 mb-1">Worker URL</label>
                                    <input type="url" id="worker-url" value={workerUrl} onChange={e => setWorkerUrl(e.target.value)} placeholder="https://worker.example.com" className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow text-gray-200" />
                                </div>
                                <div>
                                    <label htmlFor="worker-token" className="block text-sm font-medium text-gray-300 mb-1">Worker Token</label>
                                    <input type="password" id="worker-token" value={workerToken} onChange={e => setWorkerToken(e.target.value)} placeholder="••••••••••••••••" className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow text-gray-200" />
                                </div>
                            </div>
                            <button onClick={handleCloudUpload} disabled={isUploading || !workerUrl || !workerToken} className="w-full mt-6 flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition-colors duration-200">
                                {isUploading ? <><LoadingSpinner /> <span className="ml-2">Uploading...</span></> : <><CloudUploadIcon /> <span className="ml-2">Upload to Cloud</span></>}
                            </button>
                            {(uploadStatus || error) && (
                                <div className="mt-4 text-center text-sm">
                                    {error ? <p className="text-red-400">{error}</p> : <p className="text-gray-400">{uploadStatus}</p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DownloadModal;