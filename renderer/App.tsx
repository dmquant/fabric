import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { PresentationAssets, Track } from './types';
import { TrackStatus } from './types';

// --- HELPER FUNCTIONS ---

const getAudioDuration = (blob: Blob): Promise<number> => {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => {
        // Fallback for browsers that might have issues
        resolve(0);
    }
  });
};

const playAudioBuffer = (buffer: AudioBuffer, context: AudioContext, destination: AudioNode): Promise<void> => {
    return new Promise(resolve => {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(destination);
        // FIX: Explicitly resolve with `undefined` to meet the Promise resolver's requirement of one argument.
        source.onended = () => resolve(undefined);
        source.start();
    });
};


// --- ICONS ---
const UploadCloudIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
);
const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
);
const LoaderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
const DesktopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
);
const TabletIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
);
const SmartphoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
);
const SmartphoneLandscapeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="18" y1="12" x2="18.01" y2="12"/></svg>
);
const AudioWaveformIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10v4"/><path d="M6 7v10"/><path d="M10 4v16"/><path d="M14 7v10"/><path d="M18 10v4"/></svg>
);


// --- UI COMPONENTS ---

const FileUpload: React.FC<{ onFileUpload: (file: File) => void; disabled: boolean }> = ({ onFileUpload, disabled }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileUpload(e.target.files[0]);
        }
    };
    return (
        <div className="w-full h-full flex flex-col justify-center items-center p-4 md:p-8">
            <div className="w-full max-w-2xl border-2 border-dashed border-slate-300 rounded-2xl p-8 md:p-12 text-center bg-white transition-colors duration-300 hover:border-blue-400 hover:bg-blue-50">
                <label htmlFor="file-upload" className={`cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <UploadCloudIcon className="mx-auto h-12 w-12 md:h-16 md:w-16 text-slate-400" />
                    <h2 className="mt-4 text-xl md:text-2xl font-semibold text-slate-700">Upload Presentation</h2>
                    <p className="mt-2 text-sm text-slate-500">Drop a .zip file here or click to select</p>
                    <input id="file-upload" type="file" accept=".zip" className="sr-only" onChange={handleFileChange} disabled={disabled} />
                </label>
            </div>
        </div>
    );
};

const PresentationViewer: React.FC<{ assets: PresentationAssets, iframeRef: React.RefObject<HTMLIFrameElement>, onIframeLoad?: () => void }> = ({ assets, iframeRef, onIframeLoad }) => {
    const srcDoc = useMemo(() => {
        return `
      <html>
        <head>
          <style>${assets.css}</style>
        </head>
        <body>
          ${assets.html}
          <script>${assets.js}<\/script>
        </body>
      </html>
    `;
    }, [assets]);
    
    return (
        <div className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden">
            <iframe
                ref={iframeRef}
                srcDoc={srcDoc}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
                title="Presentation"
                onLoad={onIframeLoad}
            />
        </div>
    );
};

const TimelineEditor: React.FC<{ 
    tracks: Track[]; 
    totalDuration: number;
}> = ({ tracks, totalDuration }) => {
    const pixelsPerSecond = 20; 

    return (
        <div className="bg-slate-800 rounded-xl p-4 shadow-lg h-full overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="font-bold text-white">Timeline</h3>
                <div className="text-sm text-slate-400">
                    Total Duration: <span className="font-mono">{totalDuration.toFixed(1)}s</span>
                </div>
            </div>
            <div className="flex-grow overflow-hidden flex">
                {/* Fixed Labels */}
                <div className="w-20 flex-shrink-0 flex flex-col text-white text-xs font-bold bg-slate-800 border-r border-slate-700">
                    <div className="h-24 flex items-center justify-center">VIDEO</div>
                    <div className="h-12 flex items-center justify-center mt-2">AUDIO</div>
                </div>
                {/* Scrollable Tracks */}
                <div className="flex-grow overflow-x-auto overflow-y-hidden">
                    <div className="relative inline-block" style={{ width: Math.max(500, totalDuration * pixelsPerSecond), height: '100%' }}>
                        {/* Video Track */}
                        <div className="h-24 w-full absolute top-0 left-0">
                            {tracks.map((track, i) => {
                                const left = (tracks.slice(0, i).reduce((acc, t) => acc + t.duration, 0)) * pixelsPerSecond;
                                return (
                                    <div key={track.slideNumber} className="absolute top-1/2 -translate-y-1/2 h-20 bg-slate-700 rounded-lg overflow-hidden border-2 border-slate-600" style={{ left: left, width: track.duration * pixelsPerSecond }}>
                                        {track.thumbnailUrl && <img src={track.thumbnailUrl} className="w-full h-full object-cover" alt={`Slide ${track.slideNumber}`}/>}
                                        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-end p-1">
                                            <span className="text-white text-xs font-medium">S{track.slideNumber}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Audio Track */}
                        <div className="h-12 w-full absolute top-24 mt-2 left-0">
                             {tracks.map((track, i) => {
                                const left = (tracks.slice(0, i).reduce((acc, t) => acc + t.duration, 0)) * pixelsPerSecond;
                                return (
                                    <div key={track.slideNumber} className="absolute top-1/2 -translate-y-1/2 h-10 bg-sky-700 rounded-lg overflow-hidden border-2 border-sky-600 px-2 flex items-center" style={{ left: left, width: track.duration * pixelsPerSecond }}>
                                        <AudioWaveformIcon className="w-4 h-4 text-sky-300 flex-shrink-0 mr-2" />
                                        <p className="text-white text-xs font-mono truncate">
                                            {track.narration.substring(0, 50)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Loader: React.FC<{ message: string, progress?: number }> = ({ message, progress }) => (
  <div className="absolute inset-0 bg-slate-900 bg-opacity-70 flex flex-col items-center justify-center z-50 text-white backdrop-blur-sm">
      <LoaderIcon className="w-12 h-12 animate-spin text-blue-400" />
      <p className="mt-4 text-lg font-medium tracking-wider text-center px-4">{message}</p>
      {progress !== undefined && (
        <div className="w-64 mt-2 bg-slate-600 rounded-full h-2.5">
          <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      )}
  </div>
);

const DEVICES = [
  { name: 'Desktop', icon: <DesktopIcon className="w-4 h-4 mr-1 sm:mr-2"/>, aspectRatio: '16/10' },
  { name: 'Tablet', icon: <TabletIcon className="w-4 h-4 mr-1 sm:mr-2"/>, aspectRatio: '1/1' },
  { name: 'Mobile Portrait', icon: <SmartphoneIcon className="w-4 h-4 mr-1 sm:mr-2"/>, aspectRatio: '9/16' },
  { name: 'Mobile Landscape', icon: <SmartphoneLandscapeIcon className="w-4 h-4 mr-1 sm:mr-2"/>, aspectRatio: '16/9' },
];

const DeviceSelector: React.FC<{ selected: string; onSelect: (name: string) => void; disabled: boolean }> = ({ selected, onSelect, disabled }) => (
    <div className={`flex items-center flex-wrap justify-center gap-1 bg-slate-200 p-1 rounded-lg ${disabled ? 'opacity-50' : ''}`}>
        {DEVICES.map(device => (
            <button 
                key={device.name}
                onClick={() => onSelect(device.name)}
                disabled={disabled}
                title={`Switch to ${device.name} view`}
                className={`flex items-center px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-semibold transition-colors ${selected === device.name ? 'bg-white text-blue-600 shadow-sm' : 'bg-transparent text-slate-600 hover:bg-slate-300/50'}`}
            >
                {device.icon}
                <span className="hidden sm:inline">{device.name.replace(' ', '\u00A0')}</span>
            </button>
        ))}
    </div>
);

// --- MAIN APP ---

export default function App() {
    const [assets, setAssets] = useState<PresentationAssets | null>(null);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');
    const [processingProgress, setProcessingProgress] = useState<number | undefined>(undefined);
    const [selectedDevice, setSelectedDevice] = useState(DEVICES[0].name);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const animationFrameId = useRef<number>();

    const handleFileUpload = useCallback(async (file: File) => {
        setIsProcessing(true);
        setProcessingMessage('Unzipping presentation file...');
        setAssets(null);
        setTracks([]);

        try {
            const JSZip = (window as any).JSZip;
            const zip = await JSZip.loadAsync(file);
            
            const html = await zip.file('index.html')?.async('string') ?? '';
            const css = await zip.file('style.css')?.async('string') ?? '';
            const js = await zip.file('script.js')?.async('string') ?? '';
            const narrationsStr = await zip.file('narration_scripts.json')?.async('string') ?? '[]';
            const narrations = JSON.parse(narrationsStr);

            const audioFiles: { name: string, blob: Blob }[] = [];
            const audioFolder = zip.folder('audio');
            if (audioFolder) {
              for(const relativePath in audioFolder.files) {
                  const fileEntry = audioFolder.files[relativePath];
                  if (!fileEntry.dir) {
                      const blob = await fileEntry.async('blob');
                      audioFiles.push({ name: fileEntry.name, blob });
                  }
              }
            }

            setAssets({ html, css, js, narrations, audios: audioFiles });

            const initialTracks: Track[] = [];
            for (let i = 0; i < narrations.length; i++) {
                const audioFile = audioFiles.find(f => f.name.includes(`slide_${i + 1}_`));
                if (audioFile) {
                    const duration = await getAudioDuration(audioFile.blob);
                    initialTracks.push({
                        slideNumber: i + 1,
                        narration: narrations[i],
                        audioBlob: audioFile.blob,
                        videoBlob: null,
                        duration,
                        status: TrackStatus.PENDING,
                        thumbnailUrl: null,
                    });
                }
            }
            setTracks(initialTracks);

        } catch (error) {
            console.error("Error processing zip file:", error);
            alert("Failed to process zip file. Please check the file structure.");
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    }, []);
    
    const generateThumbnails = useCallback(async () => {
        if (!iframeRef.current || tracks.length === 0) return;
        setIsProcessing(true);
        setProcessingMessage("Generating slide thumbnails...");

        for (let i = 0; i < tracks.length; i++) {
            iframeRef.current.contentWindow?.postMessage({ type: 'goToSlide', index: i }, '*');
            await new Promise(res => setTimeout(res, 500)); // wait for render
            try {
                const html2canvas = (window as any).html2canvas;
                const canvas = await html2canvas(iframeRef.current.contentDocument.body, { logging: false, scale: 0.5 });
                const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
                setTracks(prev => prev.map(t => t.slideNumber === i + 1 ? { ...t, thumbnailUrl } : t));
            } catch (e) {
                console.error("Could not generate thumbnail for slide", i + 1, e);
            }
        }
        setIsProcessing(false);
    }, [tracks.length]);

    useEffect(() => {
        if(assets && tracks.length > 0 && !tracks[0].thumbnailUrl) {
           generateThumbnails();
        }
    }, [assets, tracks, generateThumbnails]);

    const handleDownload = useCallback(async () => {
        if (!iframeRef.current || tracks.length === 0 || !assets) {
            alert("No presentation loaded.");
            return;
        }
        if (typeof (window as any).MediaRecorder === "undefined") {
            alert("MediaRecorder is not supported in your browser. Please try a modern browser like Chrome or Firefox.");
            return;
        }

        setIsProcessing(true);
        
        try {
            // 0. Reload iframe to reset animations
            setProcessingMessage('Reloading presentation for recording...');
            const iframe = iframeRef.current;
            const srcDoc = `<html><head><style>${assets.css}</style></head><body>${assets.html}<script>${assets.js}<\/script></body></html>`;

            await new Promise<void>(resolve => {
                const listener = () => {
                    iframe.removeEventListener('load', listener);
                    resolve(undefined);
                };
                iframe.addEventListener('load', listener);
                iframe.srcdoc = srcDoc;
            });
            await new Promise(res => setTimeout(res, 500)); // Extra wait for JS to initialize in iframe

            const { width, height } = iframeRef.current.getBoundingClientRect();
            const captureCanvas = document.createElement('canvas');
            captureCanvas.width = Math.round(width);
            captureCanvas.height = Math.round(height);
            const ctx = captureCanvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error("Could not create canvas context");

            // 1. Setup streams
            const audioContext = new AudioContext();
            const audioDestination = audioContext.createMediaStreamDestination();
            const videoStream = captureCanvas.captureStream(30); // 30 FPS
            const audioStream = audioDestination.stream;
            const combinedStream = new MediaStream([...videoStream.getTracks(), ...audioStream.getTracks()]);
            
            // 2. Setup MediaRecorder
            const recordedChunks: Blob[] = [];
            const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' });
            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) recordedChunks.push(e.data);
            };
            mediaRecorder.onstop = () => {
              setProcessingMessage('Creating download link...');
              const blob = new Blob(recordedChunks, { type: 'video/webm' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'presentation.webm';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              setIsProcessing(false);
            };

            // 3. Start render loop
            const renderFrame = async () => {
                if (iframeRef.current?.contentDocument?.body) {
                    const html2canvas = (window as any).html2canvas;
                    const sourceCanvas = await html2canvas(iframeRef.current.contentDocument.body, { useCORS: true, allowTaint: true, logging: false, scale: 1 });
                    ctx.drawImage(sourceCanvas, 0, 0, captureCanvas.width, captureCanvas.height);
                }
                animationFrameId.current = requestAnimationFrame(renderFrame);
            };
            animationFrameId.current = requestAnimationFrame(renderFrame);
            
            // 4. Start recording and process slides
            mediaRecorder.start(100);
            
            let elapsedTime = 0;
            const totalDuration = tracks.reduce((acc, t) => acc + t.duration, 0);

            for (const track of tracks) {
                setProcessingMessage(`Recording slide ${track.slideNumber}/${tracks.length}...`);
                iframeRef.current.contentWindow?.postMessage({ type: 'goToSlide', index: track.slideNumber - 1 }, '*');
                await new Promise(resolve => setTimeout(resolve, 300)); // Settle time
                
                const audioBuffer = await audioContext.decodeAudioData(await track.audioBlob.arrayBuffer());
                await playAudioBuffer(audioBuffer, audioContext, audioDestination);

                elapsedTime += track.duration;
                setProcessingProgress((elapsedTime / totalDuration) * 100);
            }

            // 5. Cleanup
            mediaRecorder.stop();
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            audioContext.close();

        } catch (error) {
            console.error("Error during video export:", error);
            alert("An error occurred while exporting the video. Check the console for details.");
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            setIsProcessing(false);
        } finally {
            setProcessingProgress(undefined);
        }
    }, [tracks, assets]);

    const totalDuration = useMemo(() => tracks.reduce((acc, t) => acc + t.duration, 0), [tracks]);
    const selectedDeviceAspectRatio = DEVICES.find(d => d.name === selectedDevice)?.aspectRatio || '16/9';
    
    return (
        <main className="w-screen h-screen flex flex-col bg-slate-100 p-2 sm:p-4">
            {isProcessing && <Loader message={processingMessage} progress={processingProgress} />}
            <header className="flex-shrink-0 mb-2 sm:mb-4 px-2 flex justify-between items-center">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Gemini Video Composer</h1>
            </header>
            <div className="flex-grow min-h-0">
                {!assets ? (
                    <FileUpload onFileUpload={handleFileUpload} disabled={isProcessing} />
                ) : (
                    <div className="flex flex-col h-full gap-2 sm:gap-4">
                        <div className="flex-grow min-h-0 flex items-center justify-center bg-slate-200/50 p-2 sm:p-4 rounded-lg">
                            <div className="h-full max-w-full max-h-full transition-all duration-300 ease-in-out" style={{ aspectRatio: selectedDeviceAspectRatio }}>
                                <PresentationViewer assets={assets} iframeRef={iframeRef} />
                            </div>
                        </div>
                        <div className="flex-shrink-0 bg-white p-2 sm:p-3 rounded-lg shadow-md flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                            <DeviceSelector selected={selectedDevice} onSelect={setSelectedDevice} disabled={isProcessing} />
                            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
                            <button onClick={handleDownload} disabled={isProcessing || tracks.length === 0} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all text-xs sm:text-base">
                                <DownloadIcon className="w-4 h-4 sm:w-5 sm:h-5"/>
                                Generate &amp; Download Video
                            </button>
                        </div>
                        <div className="flex-shrink-0 h-[220px]">
                           <TimelineEditor tracks={tracks} totalDuration={totalDuration}/>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}