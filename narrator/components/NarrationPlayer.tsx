import React, { useState, useCallback } from 'react';
import { useGeminiTts } from '../hooks/useSpeechSynthesis';
import { PlayIcon, PauseIcon, StopIcon, SpinnerIcon, PlayFromStartIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';
import { generateNarrationScript } from '../services/geminiService';

interface NarrationPlayerProps {
  htmlContent: string;
}

const geminiVoices = [
  { id: 'Kore', name: 'Kore (Female)' },
  { id: 'Puck', name: 'Puck (Male)' },
  { id: 'Charon', name: 'Charon (Female)' },
  { id: 'Zephyr', name: 'Zephyr (Male)' },
  { id: 'Fenrir', name: 'Fenrir (Male)' },
];

const NarrationPlayer: React.FC<NarrationPlayerProps> = ({ htmlContent }) => {
  const [script, setScript] = useState('');
  const [englishScript, setEnglishScript] = useState('');
  const [chineseScript, setChineseScript] = useState('');
  const [playbackLanguage, setPlaybackLanguage] = useState<'en' | 'zh'>('en');
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const scriptToPlay = playbackLanguage === 'en' ? englishScript : chineseScript;

  const {
    isPlaying,
    isPaused,
    isLoading: isGeneratingAudio,
    error: ttsError,
    play,
    pause,
    resume,
    stop,
    playFromBeginning,
  } = useGeminiTts();
  const { t } = useLanguage();

  const canPlay = scriptToPlay.trim().length > 0 && !isGeneratingScript;

  const handleGenerateScript = useCallback(async () => {
    setIsGeneratingScript(true);
    setGenerationError(null);
    setScript('');
    setEnglishScript('');
    setChineseScript('');
    stop();
    try {
      const generatedScript = await generateNarrationScript(htmlContent);
      setScript(generatedScript);

      const parts = generatedScript.split(/Chinese:/i);
      const englishPart = (parts[0] || '').replace(/English:/i, '').trim();
      const chinesePart = parts.length > 1 ? (parts[1] || '').trim() : '';

      setEnglishScript(englishPart);
      setChineseScript(chinesePart);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsGeneratingScript(false);
    }
  }, [htmlContent, stop]);

  const handlePlayPauseResume = () => {
    if (isPlaying) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      play(scriptToPlay, selectedVoice);
    }
  };

  const handleVoiceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVoice(event.target.value);
  };

  let statusText = t('statusReady');
  if (isGeneratingAudio) statusText = t('statusLoading');
  else if (isPlaying) statusText = t('statusPlaying');
  else if (isPaused) statusText = t('statusPaused');

  return (
    <div className="mt-8">
      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex flex-col items-start">
          <h3 className="font-semibold text-lg text-white">{t('narrationTitle')}</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            {t('narrationDescription')}
          </p>

          <div className="w-full space-y-4">
            <button
              onClick={handleGenerateScript}
              disabled={isGeneratingScript}
              className={`w-full px-8 py-3 font-bold rounded-md transition-all duration-300 ease-in-out flex items-center justify-center ${
                isGeneratingScript
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg hover:shadow-indigo-600/50'
              }`}
            >
              {isGeneratingScript ? t('generatingScriptButton') : t('generateScriptButton')}
            </button>

            {(generationError || ttsError) && (
              <div className="p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-sm">
                {generationError && <p><span className="font-bold">{t('narrationErrorPrefix')}</span> {generationError}</p>}
                {ttsError && <p><span className="font-bold">{t('speechErrorPrefix')}</span> {ttsError}</p>}
              </div>
            )}

            {script && (
              <>
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">{t('narrationScript')}</h4>
                  <pre className="w-full bg-gray-900/70 border border-gray-700 rounded-md p-3 text-gray-300 text-sm whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                    {script}
                  </pre>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('playbackLanguageLabel')}</label>
                    <div className="flex items-center space-x-2 bg-gray-700 rounded-lg p-1">
                      <button
                        onClick={() => setPlaybackLanguage('en')}
                        className={`w-full py-1.5 text-sm font-semibold rounded-md transition-colors ${playbackLanguage === 'en' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                      >
                        English
                      </button>
                      <button
                        onClick={() => setPlaybackLanguage('zh')}
                        className={`w-full py-1.5 text-sm font-semibold rounded-md transition-colors ${playbackLanguage === 'zh' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                      >
                        Chinese
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                    <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-2 sm:mb-0">
                      {t('voiceLabel')}
                    </label>
                    <select
                      id="voice-select"
                      value={selectedVoice}
                      onChange={handleVoiceChange}
                      disabled={isPlaying || isPaused || isGeneratingAudio}
                      className="w-full sm:w-auto flex-grow bg-gray-700 border border-gray-600 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      {geminiVoices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={playFromBeginning}
                      disabled={!canPlay || isGeneratingAudio || (!isPlaying && !isPaused)}
                      className="p-2.5 font-bold rounded-md transition-colors text-white bg-gray-700 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                      aria-label={t('playFromStartAria')}
                    >
                      <PlayFromStartIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handlePlayPauseResume}
                      disabled={!canPlay || isGeneratingAudio}
                      className="flex-grow flex justify-center items-center px-4 py-2 font-bold rounded-md transition-colors text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                      aria-label={isPlaying ? t('pauseAria') : t('playAria')}
                    >
                      {isGeneratingAudio ? (
                        <SpinnerIcon className="w-5 h-5 mr-2 animate-spin" />
                      ) : isPlaying ? (
                        <PauseIcon className="w-5 h-5 mr-2" />
                      ) : (
                        <PlayIcon className="w-5 h-5 mr-2" />
                      )}
                      <span>{isGeneratingAudio ? t('generatingAudioButton') : (isPlaying ? t('pause') : (isPaused ? t('resume') : t('play')))}</span>
                    </button>
                    <button
                      onClick={stop}
                      disabled={!isPlaying && !isPaused}
                      className="p-2.5 font-bold rounded-md transition-colors text-white bg-gray-700 hover:bg-red-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                      aria-label={t('stopAria')}
                    >
                      <StopIcon className="w-5 h-5" />
                    </button>
                    <div className="text-sm text-gray-400 w-24 text-center" aria-live="polite">{statusText}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NarrationPlayer;