
import { useState, useRef, useCallback, useEffect } from 'react';
import { generateSpeech } from '../services/geminiService';
import { decode, decodePcmAudioData, pcmToWav } from '../utils/audioUtils';
import { useAssets } from '../contexts/AssetContext';

const SAMPLE_RATE = 24000;
const NUM_CHANNELS = 1;

export const useGeminiTts = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addAsset, addLog } = useAssets();

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const generatedForRef = useRef<{ script: string; voice: string } | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const internalStop = useCallback((clearBuffer = false) => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    if (clearBuffer) {
      audioBufferRef.current = null;
      generatedForRef.current = null;
      pauseTimeRef.current = 0;
    }
  }, []);

  const startPlayback = useCallback(
    (offset: number) => {
      if (!audioContextRef.current || !audioBufferRef.current) return;
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        // If it wasn't paused manually, it finished naturally.
        if (isPlayingRef.current) {
          internalStop(false);
          pauseTimeRef.current = 0;
        }
      };
      source.start(0, offset);
      sourceNodeRef.current = source;
      startTimeRef.current = audioContextRef.current.currentTime - offset;

      setIsPlaying(true);
      setIsPaused(false);
    },
    [internalStop]
  );

  const play = useCallback(
    async (script: string, voice: string) => {
      if (isLoading || !script || !voice) return;

      const hasCachedAudio =
        audioBufferRef.current &&
        generatedForRef.current?.script === script &&
        generatedForRef.current?.voice === voice;

      if (hasCachedAudio) {
        internalStop(false);
        startPlayback(0);
        return;
      }

      internalStop(true);
      setError(null);
      setIsLoading(true);

      try {
        addLog('info', 'Generating speech for 2D report narration.', { voice, scriptLength: script.length });
        const { data: base64Audio, mimeType } = await generateSpeech(script, voice);
        
        const audioData = decode(base64Audio);

        const sampleRateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : SAMPLE_RATE;
        const pcm16 = new Int16Array(audioData.buffer);

        try {
            const wavBlob = pcmToWav(pcm16, sampleRate);
            const filename = `narration_${voice}_${new Date().getTime()}.wav`;
            addAsset(filename, wavBlob, 'audio/wav');
            addLog('info', `Saved 2D narration asset: ${filename}`);
        } catch (e) {
            addLog('error', 'Failed to convert PCM to WAV for asset saving.', { error: e });
        }


        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
        }

        const buffer = await decodePcmAudioData(
          audioData,
          audioContextRef.current,
          SAMPLE_RATE,
          NUM_CHANNELS
        );
        audioBufferRef.current = buffer;
        generatedForRef.current = { script, voice };
        startPlayback(0);
      } catch (err) {
        console.error(err);
        const message =
          err instanceof Error
            ? err.message
            : 'An unknown error occurred during TTS generation or playback.';
        setError(message);
        addLog('error', 'TTS Generation or playback failed.', { error: message });
        internalStop(true);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, internalStop, startPlayback, addAsset, addLog]
  );

  const pause = useCallback(() => {
    if (!isPlaying || !sourceNodeRef.current || !audioContextRef.current) return;
    pauseTimeRef.current =
      audioContextRef.current.currentTime - startTimeRef.current;
    internalStop(false); // Stop playback but don't clear buffer
    setIsPaused(true);
  }, [isPlaying, internalStop]);

  const resume = useCallback(() => {
    if (!isPaused || !audioBufferRef.current) return;
    startPlayback(pauseTimeRef.current);
  }, [isPaused, startPlayback]);
  
  const playFromBeginning = useCallback(() => {
    if (!audioBufferRef.current || isLoading) return;
    internalStop(false);
    startPlayback(0);
  }, [isLoading, internalStop, startPlayback]);

  const stop = useCallback(() => {
    internalStop(false);
    pauseTimeRef.current = 0;
  }, [internalStop]);

  useEffect(() => {
    return () => {
      stop();
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close();
      }
    };
  }, [stop]);

  return { isPlaying, isPaused, isLoading, error, play, pause, resume, stop, playFromBeginning };
};