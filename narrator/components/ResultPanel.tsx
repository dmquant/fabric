
import React, { useState, useCallback, useRef } from 'react';
import { DownloadIcon, ClipboardIcon, ClipboardCheckIcon, CameraIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

// Declare JSZip and html2canvas from global scope (loaded via CDN)
declare const JSZip: any;
declare const html2canvas: any;

interface ResultPanelProps {
  htmlContent: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
}

const ResultPanel: React.FC<ResultPanelProps> = ({ htmlContent, iframeRef }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isScreenshotting, setIsScreenshotting] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(htmlContent).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  }, [htmlContent]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'financial-report.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [htmlContent]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleDownloadScreenshots = useCallback(async () => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) {
      setScreenshotError("Report is not loaded correctly.");
      return;
    }
    setIsScreenshotting(true);
    setScreenshotError(null);
    
    const iframeWindow = iframeRef.current.contentWindow as any;
    if (typeof iframeWindow.setLanguage !== 'function') {
        setScreenshotError("The report's language switching function is not available.");
        setIsScreenshotting(false);
        return;
    }

    const zip = new JSZip();

    try {
      const languages: ('en' | 'zh')[] = ['en', 'zh'];

      for (const lang of languages) {
        iframeWindow.setLanguage(lang);
        await sleep(500); // Wait for DOM and charts to update

        const iframeDoc = iframeRef.current.contentDocument!;
        const sections = Array.from(iframeDoc.querySelectorAll('main > section')) as HTMLElement[];
        
        if (sections.length === 0) throw new Error("No report sections found to screenshot.");
        
        const langFolder = zip.folder(lang)!;

        for (const [index, section] of sections.entries()) {
          section.scrollIntoView({ behavior: 'auto', block: 'start' });
          await sleep(250); // wait for scroll

          const canvas = await html2canvas(section, { 
            backgroundColor: '#1a1d23',
            scale: 2,
            logging: false,
            useCORS: true,
          });
          
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
          const sectionTitleEl = section.querySelector('h2');
          const sectionName = (sectionTitleEl?.getAttribute(`data-lang-${lang}`) || section.id || 'section').replace(/[\s/&]+/g, '_');
          const sectionNumber = (index + 1).toString().padStart(2, '0');
          const fileName = `${sectionNumber}_${sectionName}.jpg`;

          langFolder.file(fileName, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `report_screenshots_bilingual.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

    } catch (err) {
      console.error("Screenshot failed:", err);
      setScreenshotError(err instanceof Error ? err.message : "An unknown error occurred during screenshot capture.");
    } finally {
      setIsScreenshotting(false);
    }
  }, [iframeRef]);

  return (
    <div className="mt-8 pt-6 border-t border-gray-700">
      <div>
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <h2 className="text-xl font-semibold text-white">{t('resultTitle')}</h2>
          <div className="flex space-x-2">
            <button 
              onClick={handleDownloadScreenshots} 
              disabled={isScreenshotting}
              className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-md text-sm transition-colors text-white"
            >
              <CameraIcon className="w-4 h-4 mr-2" />
              {isScreenshotting ? t('capturingButton') : t('screenshotsButton')}
            </button>
            <button onClick={handleCopy} className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm transition-colors">
              {isCopied ? <ClipboardCheckIcon className="w-4 h-4 mr-2 text-green-400" /> : <ClipboardIcon className="w-4 h-4 mr-2" />}
              {isCopied ? t('copiedButton') : t('copyButton')}
            </button>
            <button onClick={handleDownload} className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm transition-colors">
              <DownloadIcon className="w-4 h-4 mr-2" />
              {t('downloadHtmlButton')}
            </button>
          </div>
        </div>

        {screenshotError && (
          <div className="my-2 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-sm">
            <p><span className="font-bold">{t('screenshotErrorPrefix')}</span> {screenshotError}</p>
          </div>
        )}

        <div className="w-full aspect-[9/16] md:aspect-video bg-white rounded-lg overflow-hidden shadow-2xl border-4 border-gray-700">
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            title={t('resultTitle')}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
};

export default ResultPanel;
