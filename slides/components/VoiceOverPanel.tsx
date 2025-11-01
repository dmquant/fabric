
import React, { useState, useEffect, useRef } from 'react';
import { generateNarrationScripts, generateSpeechForScripts } from '../services/geminiService';
import { LoadingSpinner } from './icons';

interface VoiceOverPanelProps {
    htmlContent: string;
    onNavigateToSlide: (index: number) => void;
    onScriptsGenerated: (scripts: string[]) => void;
    onAudioGenerated: (blobs: Blob[]) => void;
}

// Helper to decode base64 string to Uint8Array
const decode = (base64: string): Uint8Array => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

const VoiceOverPanel: React.FC<VoiceOverPanelProps> = ({ htmlContent, onNavigateToSlide, onScriptsGenerated, onAudioGenerated }) => {
    const [status, setStatus] = useState<'idle' | 'generating_scripts' | 'generating_audio'>('idle');
    const [scripts, setScripts] = useState<string[]>([]);
    const [audioBuffers, setAudioBuffers] = useState<AudioBuffer[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused'>('idle');
    const [currentTrack, setCurrentTrack] = useState(0);
    const [isAutoplay, setIsAutoplay] = useState(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const isAutoplayRef = useRef(isAutoplay);

    // Initialize AudioContext
    useEffect(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
    }, []);
    
    // Keep the ref in sync with the autoplay state to avoid stale closures.
    useEffect(() => {
        isAutoplayRef.current = isAutoplay;
    }, [isAutoplay]);

    const handleGenerateScripts = async () => {
        setStatus('generating_scripts');
        setError(null);
        try {
            const generatedScripts = await generateNarrationScripts(htmlContent);
            setScripts(generatedScripts);
            onScriptsGenerated(generatedScripts);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setStatus('idle');
        }
    };

    const handleGenerateAudio = async () => {
        if (scripts.length === 0) return;
        setStatus('generating_audio');
        setError(null);
        try {
            const base64AudioData = await generateSpeechForScripts(scripts);
            const audioContext = audioContextRef.current!;

            const decodedBuffers: AudioBuffer[] = [];
            const audioBlobs: Blob[] = [];

            for (const b64 of base64AudioData) {
                const rawPcmData = decode(b64);
                audioBlobs.push(new Blob([rawPcmData], { type: 'audio/pcm' }));
                const dataInt16 = new Int16Array(rawPcmData.buffer);
                const frameCount = dataInt16.length;
                const buffer = audioContext.createBuffer(1, frameCount, 24000);
                const channelData = buffer.getChannelData(0);
                for (let i = 0; i < frameCount; i++) {
                    channelData[i] = dataInt16[i] / 32768.0;
                }
                decodedBuffers.push(buffer);
            }
            setAudioBuffers(decodedBuffers);
            onAudioGenerated(audioBlobs);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setStatus('idle');
        }
    };

    const playAudio = (index: number) => {
        if (index >= audioBuffers.length || !audioContextRef.current) return;
        
        // Stop any currently playing audio
        if (sourceNodeRef.current) {
            sourceNodeRef.current.onended = null;
            sourceNodeRef.current.stop();
        }

        const audioContext = audioContextRef.current;
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        onNavigateToSlide(index);
        setCurrentTrack(index);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffers[index];
        source.connect(audioContext.destination);
        source.start();
        setPlaybackState('playing');
        
        source.onended = () => {
             if (isAutoplayRef.current && index < audioBuffers.length - 1) {
                playAudio(index + 1);
            } else {
                setPlaybackState('idle');
                // When autoplay finishes, reset to the first slide for a better user experience.
                if (isAutoplayRef.current && index === audioBuffers.length - 1) {
                    setCurrentTrack(0);
                    onNavigateToSlide(0);
                }
            }
        };

        sourceNodeRef.current = source;
    };
    
    const handlePlayPause = () => {
        if (!audioContextRef.current) return;

        if (playbackState === 'playing') {
            audioContextRef.current.suspend();
            setPlaybackState('paused');
        } else if (playbackState === 'paused') {
            audioContextRef.current.resume();
            setPlaybackState('playing');
        } else { // idle
            playAudio(currentTrack);
        }
    };
    
    const handleStop = () => {
        if (sourceNodeRef.current) {
            sourceNodeRef.current.onended = null;
            sourceNodeRef.current.stop();
            sourceNodeRef.current = null;
        }
        setPlaybackState('idle');
        setCurrentTrack(0);
        onNavigateToSlide(0);
    };

    const handleReplay = () => {
        handleStop();
        // Use a small timeout to allow state to update before playing
        setTimeout(() => playAudio(0), 50);
    };

    const handleScriptChange = (index: number, newText: string) => {
        const updatedScripts = [...scripts];
        updatedScripts[index] = newText;
        setScripts(updatedScripts);
        onScriptsGenerated(updatedScripts);
        // Invalidate audio if scripts change
        setAudioBuffers([]);
        onAudioGenerated([]);
    };

    const numSlides = (htmlContent.match(/<section class="slide/g) || []).length;
    
    return (
        <div className="flex flex-col h-full text-sm">
            <h2 className="text-xl font-bold text-gray-100 mb-4">Voice Over</h2>
            
            {/* Step 1: Generate Scripts */}
            <div className="mb-4">
                <button
                    onClick={handleGenerateScripts}
                    disabled={status !== 'idle'}
                    className="w-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors"
                >
                    {status === 'generating_scripts' ? <><LoadingSpinner />Generating Scripts...</> : '1. Generate Narration Scripts'}
                </button>
            </div>
            
            {/* Scripts List */}
            {scripts.length > 0 && (
                <div className="flex-grow mb-4 overflow-y-auto bg-gray-900/50 p-2 rounded-md border border-gray-700">
                    <h3 className="font-bold mb-2 text-gray-300">Narration Scripts ({scripts.length} / {numSlides} slides)</h3>
                     {scripts.map((script, index) => (
                        <div key={index} className="mb-2">
                             <label className="font-semibold text-gray-400 block mb-1">Slide {index + 1}</label>
                             <textarea 
                                value={script}
                                onChange={(e) => handleScriptChange(index, e.target.value)}
                                className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-purple-500 transition-shadow text-gray-200 font-mono text-xs"
                                rows={4}
                             />
                        </div>
                     ))}
                </div>
            )}
            
            {/* Step 2: Generate Audio */}
            {scripts.length > 0 && (
                 <div className="mb-4">
                    <button
                        onClick={handleGenerateAudio}
                        disabled={status !== 'idle' || scripts.length === 0}
                        className="w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        {status === 'generating_audio' ? <><LoadingSpinner />Generating Audio...</> : '2. Generate Audio'}
                    </button>
                </div>
            )}
            
            {/* Step 3: Playback Controls */}
            {audioBuffers.length > 0 && (
                <div className="bg-gray-900/50 p-3 rounded-md border border-gray-700">
                    <h3 className="font-bold mb-3 text-gray-300">Playback</h3>
                    <div className="flex items-center justify-around mb-4">
                        <button onClick={handleReplay} title="Replay" className="p-2 rounded-full hover:bg-gray-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.204 2.102l-.717.717a.75.75 0 11-1.06-1.06l1.5-1.5a.75.75 0 011.06 0l1.5 1.5a.75.75 0 11-1.06 1.06l-.717-.717A4 4 0 106.012 8.5H7.75a.75.75 0 010 1.5H4.75a.75.75 0 01-.75-.75V6.25a.75.75 0 011.5 0v1.638a5.5 5.5 0 019.812 3.536z" clipRule="evenodd" /></svg></button>
                        <button onClick={handlePlayPause} className="p-3 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors">
                            {playbackState === 'playing' 
                                ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path d="M5.75 4.5a.75.75 0 00-.75.75v10.5a.75.75 0 001.5 0V5.25A.75.75 0 005.75 4.5zm8.5 0a.75.75 0 00-.75.75v10.5a.75.75 0 001.5 0V5.25a.75.75 0 00-.75-.75z" /></svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                            }
                        </button>
                        <button onClick={handleStop} title="Stop" className="p-2 rounded-full hover:bg-gray-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M5.25 5.25a.75.75 0 00-1.5 0v9.5a.75.75 0 001.5 0v-9.5zM8.25 5a.75.75 0 01.75.75v9.5a.75.75 0 01-1.5 0V5.75A.75.75 0 018.25 5zm3.504 0a.75.75 0 01.75.75v9.5a.75.75 0 01-1.5 0V5.75a.75.75 0 01.75-.75zM15 5.25a.75.75 0 00-1.5 0v9.5a.75.75 0 001.5 0v-9.5z" /></svg></button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-gray-400">Autoplay</span>
                        <label htmlFor="autoplay-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="autoplay-toggle" className="sr-only peer" checked={isAutoplay} onChange={() => setIsAutoplay(!isAutoplay)} />
                            <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-purple-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>
                    <p className="text-xs text-center text-gray-500 mt-3">Track: {currentTrack + 1} / {audioBuffers.length}</p>
                </div>
            )}
            
            {error && <p className="text-red-400 mt-4 text-center text-xs">{error}</p>}
        </div>
    );
};

export default VoiceOverPanel;
