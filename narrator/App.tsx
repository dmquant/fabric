
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateHtmlReport, generate3dSceneData, generateAutoPresentation } from './services/geminiService';
import ResultPanel from './components/ResultPanel';
import Loader from './components/Loader';
import NarrationPlayer from './components/NarrationPlayer';
import ThreeDeeVisualizer from './components/ThreeDeeVisualizer';
import AutoPresenter from './components/AutoPresenter';
import { GithubIcon, CubeIcon, VideoCameraIcon, DownloadIcon } from './components/Icons';
import { useLanguage } from './contexts/LanguageContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useAssets } from './contexts/AssetContext';
import DownloadManager from './components/DownloadManager';
import { base64ToBlob } from './utils/fileUtils';


type ViewMode = '2d' | '3d' | 'presentation';

const App: React.FC = () => {
  const [reportContent, setReportContent] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [template, setTemplate] = useState('daily-report');
  const [theme, setTheme] = useState('cyberpunk-neon');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [sceneData, setSceneData] = useState(null);
  const [presentationData, setPresentationData] = useState(null);
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [isGeneratingViz, setIsGeneratingViz] = useState(false);
  const [isGenerating3d, setIsGenerating3d] = useState(false);
  const [isGeneratingPresentation, setIsGeneratingPresentation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presentationLanguage, setPresentationLanguage] = useState<'en' | 'zh'>('en');
  const [isDownloadManagerOpen, setIsDownloadManagerOpen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { t, setLanguage } = useLanguage();
  const { addLog, addAsset, clearAssetsAndLogs } = useAssets();

  useEffect(() => {
    if (theme === 'showroom') {
      setLanguage('zh');
    }
  }, [theme, setLanguage]);
  
  const clearLocalResults = () => {
    setGeneratedHtml('');
    setSceneData(null);
    setPresentationData(null);
    setViewMode(null);
    setError(null);
  };

  const prepareForGeneration = (generationName: string) => {
    if (!reportContent.trim()) {
      const errorMsg = t('reportContentError');
      setError(errorMsg);
      addLog('warn', 'Generation attempted with empty report content.');
      return false;
    }
    clearAssetsAndLogs();
    addLog('info', `Starting ${generationName} generation.`);
    addAsset('input_report.txt', new Blob([reportContent], { type: 'text/plain' }), 'text/plain');
    clearLocalResults();
    return true;
  }

  const handleGenerateVisualization = useCallback(async () => {
    if (!prepareForGeneration('2D Report')) return;

    setIsGeneratingViz(true);
    try {
      const html = await generateHtmlReport(reportContent, model, template);
      setGeneratedHtml(html);
      setViewMode('2d');
      addAsset('report.html', new Blob([html], { type: 'text/html' }), 'text/html');
      addLog('info', '2D Report HTML generated successfully.');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error(err);
      setError(errorMsg);
      addLog('error', 'Failed to generate 2D report.', { error: errorMsg });
    } finally {
      setIsGeneratingViz(false);
    }
  }, [reportContent, model, template, t, addAsset, addLog, clearAssetsAndLogs]);

  const handleGenerate3dScene = useCallback(async () => {
    if (!prepareForGeneration('3D Scene')) return;
    
    setIsGenerating3d(true);
    try {
      const data = await generate3dSceneData(reportContent, theme);
      setSceneData(data);
      setViewMode('3d');
      const jsonString = JSON.stringify(data, null, 2);
      addAsset('scene_data_3d.json', new Blob([jsonString], { type: 'application/json' }), 'application/json');
      addLog('info', '3D Scene data generated successfully.');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error(err);
      setError(errorMsg);
      addLog('error', 'Failed to generate 3D scene data.', { error: errorMsg });
    } finally {
      setIsGenerating3d(false);
    }
  }, [reportContent, theme, t, addAsset, addLog, clearAssetsAndLogs]);

  const handleGeneratePresentation = useCallback(async () => {
    if (!prepareForGeneration('Auto Presentation')) return;

    setIsGeneratingPresentation(true);
    try {
        const data = await generateAutoPresentation(reportContent, presentationLanguage);
        setPresentationData(data);
        setViewMode('presentation');
        addLog('info', 'Auto Presentation data generated successfully.');
        const jsonString = JSON.stringify(data, null, 2);
        addAsset('presentation.json', new Blob([jsonString], { type: 'application/json' }), 'application/json');

        addLog('info', 'Extracting and saving background images from presentation data.');
        data.scenes.forEach((scene: any, index: number) => {
            if (scene.backgroundImage && scene.backgroundImage.startsWith('data:image')) {
                const [header, base64Data] = scene.backgroundImage.split(',');
                if (base64Data) {
                    const mimeType = header.match(/:(.*?);/)[1];
                    const blob = base64ToBlob(base64Data, mimeType);
                    addAsset(`presentation_assets/scene_${index + 1}_bg.jpg`, blob, 'image/jpeg');
                }
            }
        });

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred.';
        console.error(err);
        setError(errorMsg);
        addLog('error', 'Failed to generate Auto Presentation.', { error: errorMsg });
    } finally {
        setIsGeneratingPresentation(false);
    }
  }, [reportContent, presentationLanguage, t, addAsset, addLog, clearAssetsAndLogs]);

  const isGenerating = isGeneratingViz || isGenerating3d || isGeneratingPresentation;
  const canGenerate = reportContent.trim().length > 0 && !isGenerating;

  const renderContent = () => {
    if (isGenerating) {
      return <Loader />;
    }
    if (error) {
      return (
        <div className="mt-6 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md">
          <p><span className="font-bold">{t('errorPrefix')}</span> {error}</p>
        </div>
      );
    }
    if (viewMode === 'presentation' && presentationData) {
        return <AutoPresenter presentationData={presentationData} />;
    }
    if (viewMode === '2d' && generatedHtml) {
      return (
        <>
          <ResultPanel htmlContent={generatedHtml} iframeRef={iframeRef} />
          <NarrationPlayer htmlContent={generatedHtml} />
        </>
      );
    }
    if (viewMode === '3d' && sceneData) {
      return <ThreeDeeVisualizer sceneData={sceneData} />;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-20">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold text-yellow-400">{t('title')}</h1>
          <div className="flex items-center gap-4">
            <button
                onClick={() => setIsDownloadManagerOpen(true)}
                className="text-gray-400 hover:text-white transition-colors"
                title={t('downloadAssetsTitle')}
              >
                <DownloadIcon className="w-7 h-7" />
            </button>
            <LanguageSwitcher />
            <a
              href="https://github.com/google/generative-ai-docs/tree/main/site/en/gemini-api/docs/applications/prompting_images"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              title={t('githubLink')}
            >
              <GithubIcon className="w-7 h-7" />
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8 flex-grow w-full">
        <div className="max-w-6xl mx-auto">
          <p className="mb-6 text-gray-400">
            {t('description')}
          </p>

          <div className="bg-gray-800 border border-gray-700 rounded-md shadow-sm p-1 md:p-2">
            <label htmlFor="reportContent" className="sr-only">{t('reportContentTab')}</label>
            <textarea
              id="reportContent"
              value={reportContent}
              onChange={(e) => setReportContent(e.target.value)}
              placeholder={t('reportContentPlaceholder')}
              rows={12}
              className="w-full bg-gray-800 border-0 rounded-md p-3 text-gray-300 focus:ring-2 focus:ring-inset focus:ring-yellow-500 transition-colors"
            />
          </div>
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 flex flex-col">
               <h3 className="font-semibold text-lg text-yellow-400">{t('vizGeneratorTitle')}</h3>
               <p className="text-sm text-gray-400 mt-1 mb-4 flex-grow">{t('vizGeneratorDescription')}</p>
               <div className="space-y-4">
                  <div>
                    <label htmlFor="template-select" className="block text-sm font-medium text-gray-300 mb-2">{t('templateLabel')}</label>
                    <select
                      id="template-select"
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2.5 text-gray-200 sm:text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                    >
                      <option value="daily-report">{t('templateDailyReport')}</option>
                      <option value="liquid-glass">{t('templateLiquidGlass')}</option>
                      <option value="legacy">{t('templateLegacy')}</option>
                      <option value="infographic">{t('templateInfographic')}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="model-select" className="block text-sm font-medium text-gray-300 mb-2">{t('modelLabel')}</label>
                    <select
                      id="model-select"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2.5 text-gray-200 sm:text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                    >
                      <option value="gemini-2.5-flash">{t('modelFlash')}</option>
                      <option value="gemini-2.5-pro">{t('modelPro')}</option>
                      <option value="gemini-2.5-flash-lite">{t('modelFlashLite')}</option>
                    </select>
                  </div>
                  <button
                    onClick={handleGenerateVisualization}
                    disabled={!canGenerate}
                    className={`w-full px-8 py-3 font-bold rounded-md transition-all duration-300 ease-in-out ${
                      canGenerate
                        ? 'bg-yellow-600 text-gray-900 hover:bg-yellow-500 shadow-lg hover:shadow-yellow-600/50'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isGeneratingViz ? t('generatingVizButton') : t('generateVizButton')}
                  </button>
               </div>
            </div>
            
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 flex flex-col">
               <h3 className="font-semibold text-lg text-teal-400 flex items-center gap-2"><CubeIcon className="w-6 h-6" /> {t('threeDeeGeneratorTitle')}</h3>
               <p className="text-sm text-gray-400 mt-1 mb-4 flex-grow">{t('threeDeeGeneratorDescription')}</p>
               <div className="space-y-4">
                  <div>
                    <label htmlFor="theme-select" className="block text-sm font-medium text-gray-300 mb-2">{t('themeLabel')}</label>
                    <select
                      id="theme-select"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2.5 text-gray-200 sm:text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="showroom">{t('themeShowroom')}</option>
                      <option value="cyberpunk-neon">{t('themeCyberpunk')}</option>
                      <option value="corporate-blue">{t('themeCorporate')}</option>
                      <option value="lush-nature">{t('themeNature')}</option>
                    </select>
                  </div>
                  <button
                    onClick={handleGenerate3dScene}
                    disabled={!canGenerate}
                    className={`w-full px-8 py-3 font-bold rounded-md transition-all duration-300 ease-in-out ${
                      canGenerate
                        ? 'bg-teal-600 text-white hover:bg-teal-500 shadow-lg hover:shadow-teal-600/50'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isGenerating3d ? t('generating3dButton') : t('generate3dButton')}
                  </button>
               </div>
            </div>

            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 flex flex-col">
               <h3 className="font-semibold text-lg text-purple-400 flex items-center gap-2"><VideoCameraIcon className="w-6 h-6" /> {t('autoPresentationGeneratorTitle')}</h3>
               <p className="text-sm text-gray-400 mt-1 mb-4 flex-grow">{t('autoPresentationGeneratorDescription')}</p>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="presentation-lang-select" className="block text-sm font-medium text-gray-300 mb-2">{t('presentationLanguageLabel')}</label>
                        <div className="flex items-center space-x-2 bg-gray-700 rounded-lg p-1">
                            <button
                                onClick={() => setPresentationLanguage('en')}
                                className={`w-full py-1.5 text-sm font-semibold rounded-md transition-colors ${presentationLanguage === 'en' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                            >
                                English
                            </button>
                            <button
                                onClick={() => setPresentationLanguage('zh')}
                                className={`w-full py-1.5 text-sm font-semibold rounded-md transition-colors ${presentationLanguage === 'zh' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                            >
                                Chinese
                            </button>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleGeneratePresentation}
                        disabled={!canGenerate}
                        className={`w-full px-8 py-3 font-bold rounded-md transition-all duration-300 ease-in-out ${
                            canGenerate
                            ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg hover:shadow-purple-600/50'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {isGeneratingPresentation ? t('generatingPresentationButton') : t('generatePresentationButton')}
                    </button>
                </div>
            </div>
          </div>
          
          { (generatedHtml || sceneData) && !isGenerating && (
            <div className="mt-8 flex justify-center">
              <div className="p-1 bg-gray-700 rounded-lg flex items-center space-x-1">
                 <button onClick={() => setViewMode('2d')} disabled={!generatedHtml} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${viewMode === '2d' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'} disabled:text-gray-500 disabled:hover:bg-transparent`}>
                   {t('view2DReport')}
                 </button>
                 <button onClick={() => setViewMode('3d')} disabled={!sceneData} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${viewMode === '3d' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'} disabled:text-gray-500 disabled:hover:bg-transparent`}>
                   {t('view3DScene')}
                 </button>
              </div>
            </div>
          )}

          {renderContent()}

        </div>
      </main>

      {isDownloadManagerOpen && <DownloadManager onClose={() => setIsDownloadManagerOpen(false)} />}

      <footer className="text-center p-4 text-gray-500 text-sm border-t border-gray-800">
        <p>{t('footerText')}</p>
      </footer>
    </div>
  );
};

export default App;