
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { generateSpeech } from '../services/geminiService';
import { decode, pcmToWav } from '../utils/audioUtils';
import { PlayCircleIcon, RingLoaderIcon, PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon, StopIcon } from './Icons';
import { useAssets } from '../contexts/AssetContext';

interface AutoPresenterProps {
  presentationData: {
    scenes: any[];
  };
}

const SceneRenderer: React.FC<{ scene: any }> = ({ scene }) => {
    const renderContent = () => {
        switch(scene.type) {
            case 'TITLE_CARD':
                return (
                    <div className="text-center">
                        <h1 className="text-5xl font-bold mb-4 text-red-400 fade-in-up">{scene.title}</h1>
                        <p className="text-xl text-gray-400 fade-in-up" style={{ animationDelay: '0.3s' }}>{scene.data.subtitle}</p>
                    </div>
                );
            case 'KEY_METRICS':
                return (
                    <div className="flex flex-col items-center justify-center w-full">
                        <h2 className="text-4xl font-bold text-center mb-10 fade-in-up text-red-300">{scene.title}</h2>
                        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                            {scene.data.metrics.map((metric: any, index: number) => (
                                <div key={index} className="text-center fade-in-up p-4 bg-black/40 backdrop-blur-sm rounded-lg" style={{ animationDelay: `${0.2 * (index + 1)}s` }}>
                                    <h3 className="text-2xl font-semibold text-gray-300">{metric.label}</h3>
                                    <p className="text-3xl text-red-400 mt-2 font-bold">{metric.value}</p>
                                    <div className="text-lg mt-2">
                                        <p className="text-red-400 font-bold">{metric.change}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
             case 'LIST':
                return (
                    <div className="flex flex-col items-center justify-center w-full max-w-3xl">
                        <h2 className="text-4xl font-bold text-center mb-10 fade-in-up">{scene.title}</h2>
                        <div className="w-full space-y-4">
                            {scene.data.items.map((item: any, index: number) => (
                                <div key={index} className="flex justify-between items-center bg-black/40 backdrop-blur-sm p-3 rounded-lg fade-in-up" style={{ animationDelay: `${0.2 * (index + 1)}s` }}>
                                    <span className="text-2xl font-bold">{item.name}</span>
                                    <span className={`text-2xl font-bold ${item.detail.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{item.detail}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'BAR_CHART':
                 return (
                    <div className="flex flex-col items-center justify-center w-full max-w-3xl">
                        <h2 className="text-4xl font-bold text-center mb-10 fade-in-up">{scene.title}</h2>
                        <div className="w-full space-y-5 text-xl">
                            {scene.data.bars.map((bar: any, index: number) => (
                                <div key={index} className="fade-in-up" style={{ animationDelay: `${0.2 * (index + 1)}s` }}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold">{bar.label}</span>
                                        <span className={`font-bold ${bar.color === 'red' ? 'text-red-400' : 'text-green-400'}`}>{bar.value}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-4">
                                        <div 
                                            className={`${bar.color === 'red' ? 'bg-red-500' : 'bg-green-500'} h-4 rounded-full bar-anim`} 
                                            style={{ '--target-width': `${Math.min(Math.abs(bar.value) * 20, 100)}%` } as React.CSSProperties}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                 );
            case 'SINGLE_FOCUS':
                return (
                     <div className="text-center">
                        <h2 className="text-5xl font-bold text-red-300 fade-in-up">{scene.title}</h2>
                        <p className="text-gray-300 mt-4 text-lg fade-in-up" style={{ animationDelay: '0.3s' }}>{scene.data.description}</p>
                        <div className="mt-8 fade-in-up" style={{ animationDelay: '0.6s' }}>
                            <p className="text-3xl font-bold">{scene.data.label}</p>
                            <p className="text-4xl font-bold text-red-400 mt-2">{scene.data.value}</p>
                        </div>
                    </div>
                );
            case 'OUTLOOK':
                return (
                    <div className="flex flex-col items-center justify-center w-full">
                        <h2 className="text-5xl font-bold text-center mb-12 fade-in-up text-blue-300">{scene.title}</h2>
                        <div className="flex justify-around w-full max-w-4xl">
                             {scene.data.points.map((point: any, index: number) => (
                                <div key={index} className="text-center fade-in-up" style={{ animationDelay: `${0.3 * (index + 1)}s` }}>
                                    <h3 className="text-xl font-semibold">{point.title}</h3>
                                    <p className="text-gray-400">{point.detail}</p>
                                </div>
                             ))}
                        </div>
                    </div>
                );
            default:
                return <h2 className="text-4xl font-bold">{scene.title}</h2>;
        }
    }
    return (
         <div className="scene-content w-full h-full flex flex-col items-center justify-center p-12 text-white">
            {renderContent()}
         </div>
    );
};

const AutoPresenter: React.FC<AutoPresenterProps> = ({ presentationData }) => {
    const { t } = useLanguage();
    const { addAsset, addLog } = useAssets();
    const [status, setStatus] = useState(t('generatingAudioStatus'));
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentSceneIndex, setCurrentSceneIndex] = useState(-1); // -1 intro, -2 outro
    const [progress, setProgress] = useState(0);

    const scenes = presentationData.scenes;
    const audioQueueRef = useRef<(AudioBuffer | null)[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const sceneDurationsRef = useRef<number[]>([]);
    const totalDurationRef = useRef<number>(0);
    const playbackStartTimeRef = useRef<number>(0);
    const pauseOffsetRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    const stopCurrentAudio = useCallback(() => {
        if (currentAudioSourceRef.current) {
            currentAudioSourceRef.current.onended = null;
            try {
                currentAudioSourceRef.current.stop();
            } catch (e) { /* ignore if already stopped */ }
            currentAudioSourceRef.current = null;
        }
    }, []);

    const pregenerateAllAudio = useCallback(async () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        audioQueueRef.current = [];
        sceneDurationsRef.current = [];
        addLog('info', 'Pregenerating all audio for presentation.');

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            try {
                setStatus(`${t('generatingSpeechStatus')} (${i + 1}/${scenes.length})`);
                const { data, mimeType } = await generateSpeech(scene.narration, 'Charon');
                const pcmData = decode(data);
                const sampleRateMatch = mimeType.match(/rate=(\d+)/);
                const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
                const pcm16 = new Int16Array(pcmData.buffer);
                const wavBlob = pcmToWav(pcm16, sampleRate);

                const filename = `presentation_assets/scene_${i + 1}_audio.wav`;
                addAsset(filename, wavBlob, 'audio/wav');
                addLog('info', `Saved presentation audio asset: ${filename}`);

                const arrayBuffer = await wavBlob.arrayBuffer();
                const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
                audioQueueRef.current.push(audioBuffer);
                sceneDurationsRef.current.push(audioBuffer.duration);
            } catch (error) {
                console.error(`Audio generation failed for scene ${i}:`, error);
                addLog('error', `Failed to generate audio asset for scene ${i+1}.`, { error });
                audioQueueRef.current.push(null);
                sceneDurationsRef.current.push(3); // Default duration for failed audio
            }
        }
        totalDurationRef.current = sceneDurationsRef.current.reduce((a, b) => a + b, 0);
        setStatus(t('audioReadyStatus'));
        setIsLoading(false);
    }, [scenes, t, addAsset, addLog]);

    const goToNextScene = useCallback(() => {
        pauseOffsetRef.current = 0;
        setCurrentSceneIndex(prevIndex => {
            if (prevIndex + 1 >= scenes.length) {
                setIsPlaying(false);
                setIsPaused(false);
                return -2; // End of presentation -> outro
            }
            return prevIndex + 1;
        });
    }, [scenes.length]);

    const playAudioForScene = useCallback((buffer: AudioBuffer, offset: number) => {
        if (!audioContextRef.current) return;
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
            if (isPlaying && !isPaused) {
                goToNextScene();
            }
        };
        source.start(0, offset);
        currentAudioSourceRef.current = source;
        playbackStartTimeRef.current = audioContextRef.current.currentTime - offset;
    }, [isPlaying, isPaused, goToNextScene]);
    
    // Playback Core Logic
    useEffect(() => {
        stopCurrentAudio();
        if (isPlaying && !isPaused && currentSceneIndex >= 0 && currentSceneIndex < scenes.length) {
            const audioBuffer = audioQueueRef.current[currentSceneIndex];
            if (audioBuffer) {
                playAudioForScene(audioBuffer, pauseOffsetRef.current);
            } else {
                setTimeout(goToNextScene, 2000);
            }
        }
    }, [currentSceneIndex, isPlaying, isPaused, scenes.length, playAudioForScene, goToNextScene, stopCurrentAudio]);

    // Autoplay
    useEffect(() => {
        if (!isLoading && audioQueueRef.current.length > 0) {
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
            setIsPlaying(true);
            setCurrentSceneIndex(0);
        }
    }, [isLoading]);

    const updateProgress = useCallback(() => {
        if (!isPlaying || isPaused || currentSceneIndex < 0 || !audioContextRef.current) {
            animationFrameRef.current = null;
            return;
        }
        const elapsedInCurrentScene = audioContextRef.current.currentTime - playbackStartTimeRef.current;
        let totalElapsed = 0;
        for (let i = 0; i < currentSceneIndex; i++) {
            totalElapsed += sceneDurationsRef.current[i] || 0;
        }
        totalElapsed += elapsedInCurrentScene;
        const progressPercent = totalDurationRef.current > 0 ? (totalElapsed / totalDurationRef.current) * 100 : 0;
        setProgress(Math.min(progressPercent, 100));
        animationFrameRef.current = requestAnimationFrame(updateProgress);
    }, [isPlaying, isPaused, currentSceneIndex]);

    useEffect(() => {
        if (isPlaying && !isPaused) {
            if (animationFrameRef.current === null) {
                animationFrameRef.current = requestAnimationFrame(updateProgress);
            }
        } else {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        }
        return () => {
            if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isPlaying, isPaused, updateProgress]);

    useEffect(() => {
        pregenerateAllAudio();
        return () => {
            stopCurrentAudio();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [pregenerateAllAudio, stopCurrentAudio]);

    // --- Control Handlers ---
    const handleInitialPlay = () => {
        if (isLoading) return;
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        setIsPlaying(true);
        setCurrentSceneIndex(0);
    };

    const handlePlayPause = () => {
        if (!isPlaying) return;
        if (isPaused) { // Resume
            if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
            setIsPaused(false);
        } else { // Pause
            pauseOffsetRef.current = audioContextRef.current!.currentTime - playbackStartTimeRef.current;
            stopCurrentAudio();
            setIsPaused(true);
        }
    };

    const handleNext = () => {
        if (!isPlaying || currentSceneIndex < 0) return;
        goToNextScene();
    };

    const handlePrev = () => {
        if (!isPlaying || currentSceneIndex < 0) return;
        pauseOffsetRef.current = 0;
        setCurrentSceneIndex(i => Math.max(0, i - 1));
    };

    const resetPresentation = useCallback(() => {
        stopCurrentAudio();
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(0);
        setCurrentSceneIndex(-1); // Intro
        pauseOffsetRef.current = 0;
    }, [stopCurrentAudio]);

    return (
        <div className="mt-8 pt-6 border-t border-gray-700">
            <div className="w-full aspect-[16/9] bg-black rounded-xl shadow-2xl overflow-hidden flex flex-col">
                <div className="relative flex-grow">
                    {/* Intro Scene */}
                    <div className={`absolute inset-0 transition-opacity duration-700 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-800 to-gray-900 ${currentSceneIndex === -1 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                        {isLoading ? (
                             <div className="flex flex-col items-center">
                                <RingLoaderIcon className="w-10 h-10" />
                                <p className="text-gray-400 mt-4 text-sm">{status}</p>
                            </div>
                        ) : (
                            <button onClick={handleInitialPlay} className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-8 rounded-full text-2xl shadow-lg transition-transform transform hover:scale-105">
                                <PlayCircleIcon className="w-8 h-8 inline-block mr-3" />
                                {t('playNarrationButton')}
                            </button>
                        )}
                    </div>

                    {/* Dynamic Scenes */}
                    {scenes.map((scene, index) => (
                        <div key={scene.id} className={`absolute inset-0 transition-opacity duration-1000 bg-cover bg-center ${currentSceneIndex === index ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`} style={{backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${scene.backgroundImage})`}}>
                            {currentSceneIndex === index && <SceneRenderer scene={scene} />}
                        </div>
                    ))}

                    {/* Outro Scene */}
                    <div className={`absolute inset-0 transition-opacity duration-700 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-800 to-gray-900 ${currentSceneIndex === -2 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                         <h2 className="text-4xl font-bold fade-in-up">{t('outroTitle')}</h2>
                         <p className="text-lg text-gray-400 mt-4 fade-in-up" style={{ animationDelay: '0.3s' }}>{t('outroSubtitle')}</p>
                         <button onClick={resetPresentation} className="mt-8 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-full text-lg shadow-lg transition-transform transform hover:scale-105 fade-in-up" style={{ animationDelay: '0.6s' }}>
                           {t('replayButton')}
                         </button>
                    </div>

                    {/* Playback Controls */}
                    <div className={`absolute bottom-0 left-0 right-0 p-4 z-20 transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <div className="max-w-3xl mx-auto bg-black/50 backdrop-blur-md rounded-xl p-2 flex items-center gap-3 text-white">
                            <button onClick={handlePrev} className="p-2 hover:bg-white/20 rounded-full transition-colors"><SkipPreviousIcon className="w-6 h-6" /></button>
                            <button onClick={handlePlayPause} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                                {isPaused ? <PlayIcon className="w-6 h-6" /> : <PauseIcon className="w-6 h-6" />}
                            </button>
                            <button onClick={handleNext} className="p-2 hover:bg-white/20 rounded-full transition-colors"><SkipNextIcon className="w-6 h-6" /></button>
                            <div className="flex-grow h-1.5 bg-white/20 rounded-full">
                                <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                            <button onClick={resetPresentation} className="p-2 hover:bg-white/20 rounded-full transition-colors"><StopIcon className="w-6 h-6" /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutoPresenter;