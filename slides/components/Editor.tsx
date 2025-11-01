import React, { useState, useEffect, useRef } from 'react';
import GeminiPanel from './GeminiPanel';
import VoiceOverPanel from './VoiceOverPanel';
import { generateHtml } from '../services/geminiService';
import { bootstrapScript } from './bootstrap';
import { BackIcon, CodeIcon, DesktopIcon, DownloadIcon, LandscapeIcon, MobileIcon, PortraitIcon, PreviewIcon, TabletIcon, VoiceOverIcon } from './icons';
import DownloadModal from './DownloadModal';


interface EditorProps {
  initialCode: { html: string; css: string; js: string };
  onBack: () => void;
}

type ViewMode = 'editor' | 'code' | 'preview';
type Device = 'desktop' | 'tablet' | 'mobile-portrait' | 'mobile-landscape';

const deviceDimensions: Record<Device, { width: string; height: string }> = {
    desktop: { width: '100%', height: '100%' },
    tablet: { width: '768px', height: '1024px' },
    'mobile-portrait': { width: '390px', height: '844px' },
    'mobile-landscape': { width: '844px', height: '390px' },
};

const Editor: React.FC<EditorProps> = ({ initialCode, onBack }) => {
  const [code, setCode] = useState(initialCode);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ selector: string; html: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [device, setDevice] = useState<Device>('desktop');
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isVoiceOverPanelOpen, setIsVoiceOverPanelOpen] = useState(false);
  const [geminiLogs, setGeminiLogs] = useState<any[]>([]);
  const [narrationScripts, setNarrationScripts] = useState<string[]>([]);
  const [audioBlobs, setAudioBlobs] = useState<Blob[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);
  
  const getFullHtml = (currentCode: { html: string; css: string; js: string }) => {
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
          <style>${currentCode.css}</style>
        </head>
        <body>
          ${currentCode.html}
          <script>${bootstrapScript}${currentCode.js}</script>
        </body>
      </html>
    `;
  };

  const handleGenerate = async (prompt: string) => {
    setIsLoading(true);
    setGeminiLogs(prev => [...prev, { timestamp: new Date().toISOString(), type: 'prompt', content: prompt }]);
    try {
      const newCode = await generateHtml(prompt, code.html, code.css, code.js, selectedElement?.selector || null);
      setCode(newCode);
      setSelectedElement(null);
      setGeminiLogs(prev => [...prev, { timestamp: new Date().toISOString(), type: 'response', content: 'Code generation successful.' }]);
    } catch (error: any) {
      console.error('Failed to generate HTML:', error);
       setGeminiLogs(prev => [...prev, { timestamp: new Date().toISOString(), type: 'error', content: error.message }]);
      alert('An error occurred while generating the code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleCodeChange = (newHtml: string) => {
    if (!selectedElement || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const elementToUpdate = doc.querySelector(selectedElement.selector);
    if (elementToUpdate) {
        const tempContainer = doc.createElement('div');
        tempContainer.innerHTML = newHtml;
        const newElement = tempContainer.firstChild as HTMLElement;

        if (newElement) {
             elementToUpdate.replaceWith(newElement);
             const updatedFullHtml = doc.body.innerHTML;
             setCode(current => ({ ...current, html: updatedFullHtml }));
             // Update the state for the panel to show the potentially formatted new HTML
             setSelectedElement(current => current ? { ...current, html: newElement.outerHTML } : null);
        }
    }
  };

  const navigateToSlide = (index: number) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'goToSlide', index }, '*');
  };


  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || viewMode !== 'editor') return;

    const handleIframeLoad = () => {
        const doc = iframe.contentDocument;
        if (!doc) return;
        
        const style = doc.createElement('style');
        style.textContent = `
            *:hover { outline: 1px dashed #a855f7; cursor: pointer; }
            .gemini-selected { outline: 2px solid #a855f7 !important; outline-offset: 2px; }
            .gemini-editing { 
                outline: 2px solid #4ade80 !important; /* A green color for editing */
                outline-offset: 2px;
                background-color: rgba(74, 222, 128, 0.1);
                caret-color: #f1f5f9;
            }
        `;
        doc.head.appendChild(style);

        const handleElementClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target as HTMLElement;

            // Deselect if clicking the background
            if (target.tagName === 'BODY' || target.tagName === 'HTML') {
                doc.querySelectorAll('.gemini-selected').forEach(el => el.classList.remove('gemini-selected'));
                setSelectedElement(null);
                return;
            }

            // Prevent selection when an element is being edited
            if (target.isContentEditable) {
                return;
            }
            
            doc.querySelectorAll('.gemini-selected').forEach(el => el.classList.remove('gemini-selected'));
            target.classList.add('gemini-selected');

            let selector = '';
            let element: HTMLElement | null = target;
            while(element && element.tagName !== 'BODY' && element.tagName !== 'HTML') {
                const tagName = element.tagName.toLowerCase();
                if (element.id) {
                    selector = `#${element.id}` + (selector ? ` > ${selector}` : '');
                    break;
                }
                let nth = '';
                if (element.parentElement) {
                    const siblings = Array.from(element.parentElement.children);
                    const sameTagSiblings = siblings.filter(sib => sib.tagName === element.tagName);
                    if (sameTagSiblings.length > 1) {
                        const index = sameTagSiblings.indexOf(element) + 1;
                        nth = `:nth-of-type(${index})`;
                    }
                }
                selector = `${tagName}${nth}` + (selector ? ` > ${selector}` : '');
                element = element.parentElement;
            }
            setSelectedElement({ selector: selector.trim(), html: target.outerHTML });
        };

        const isEditable = (el: HTMLElement) => {
            if (el.isContentEditable) return false;
            if (el.tagName === 'BODY' || el.tagName === 'HTML' || el.tagName === 'SECTION') return false;
            if (el.tagName === 'CANVAS' || el.closest('canvas')) return false;
            if (el.tagName === 'SVG' || el.closest('svg')) return false;

            const hasTextContent = Array.from(el.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() !== '');
            const isTextTag = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'A', 'BUTTON', 'LI', 'TD', 'TH', 'STRONG', 'EM', 'B', 'I'].includes(el.tagName);

            if (el.children.length > 0 && !hasTextContent && !isTextTag) return false;
            
            return true;
        };

        const handleElementDblClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target as HTMLElement;

            if (!isEditable(target)) return;
            
            const currentlyEditing = doc.querySelector('.gemini-editing') as HTMLElement | null;
            if (currentlyEditing && currentlyEditing !== target) {
                currentlyEditing.blur();
            }

            doc.querySelectorAll('.gemini-selected').forEach(el => el.classList.remove('gemini-selected'));
            setSelectedElement(null);

            target.contentEditable = 'true';
            target.classList.add('gemini-editing');
            target.focus();
            
            const range = doc.createRange();
            range.selectNodeContents(target);
            const selection = doc.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);

            const originalHtml = target.innerHTML;

            let handleBlur: () => void;
            let handleKeyDown: (ke: KeyboardEvent) => void;
            
            const cleanup = () => {
                target.removeEventListener('blur', handleBlur);
                target.removeEventListener('keydown', handleKeyDown);
            };

            handleBlur = () => {
                target.contentEditable = 'false';
                target.classList.remove('gemini-editing');
                
                // Special handling for count-up elements to preserve animation
                if (target.classList.contains('count-up')) {
                    const newValue = parseFloat(target.innerText);
                    if (!isNaN(newValue)) {
                        target.setAttribute('data-value', newValue.toString());
                        target.innerText = '0'; // Reset for animation
                    }
                }

                const updatedHtml = doc.body.innerHTML;
                setCode(currentCode => ({ ...currentCode, html: updatedHtml }));
                
                cleanup();
            };

            handleKeyDown = (ke: KeyboardEvent) => {
                if (ke.key === 'Enter' && !ke.shiftKey) {
                    ke.preventDefault();
                    target.blur(); 
                }
                if (ke.key === 'Escape') {
                    ke.preventDefault();
                    target.innerHTML = originalHtml;
                    target.blur();
                }
            };

            target.addEventListener('blur', handleBlur);
            target.addEventListener('keydown', handleKeyDown);
        };

        doc.body.addEventListener('click', handleElementClick);
        doc.body.addEventListener('dblclick', handleElementDblClick);
    };

    iframe.addEventListener('load', handleIframeLoad);

    return () => {
    };

  }, [code, viewMode]);

  const CodeView = () => (
    <div className="flex flex-col md:flex-row h-full w-full bg-gray-800 p-2 gap-2">
      <div className="flex flex-col w-full md:w-1/2 h-1/2 md:h-full">
        <label className="text-sm font-bold text-gray-400 p-2">HTML</label>
        <textarea value={code.html} onChange={(e) => setCode({...code, html: e.target.value})} className="w-full h-full bg-gray-900 text-gray-200 p-2 border border-gray-700 rounded-md resize-none font-mono text-sm" />
      </div>
      <div className="flex flex-col w-full md:w-1/2 h-1/2 md:h-full gap-2">
        <div className="flex flex-col h-1/2">
            <label className="text-sm font-bold text-gray-400 p-2">CSS</label>
            <textarea value={code.css} onChange={(e) => setCode({...code, css: e.target.value})} className="w-full h-full bg-gray-900 text-gray-200 p-2 border border-gray-700 rounded-md resize-none font-mono text-sm" />
        </div>
        <div className="flex flex-col h-1/2">
            <label className="text-sm font-bold text-gray-400 p-2">JavaScript</label>
            <textarea value={code.js} onChange={(e) => setCode({...code, js: e.target.value})} className="w-full h-full bg-gray-900 text-gray-200 p-2 border border-gray-700 rounded-md resize-none font-mono text-sm" />
        </div>
      </div>
    </div>
  );

  const mainContentWidth = () => {
    let width = '100%';
    if (viewMode === 'editor') {
        const geminiPanelWidth = '33.333333%'; // w-1/3
        const voiceOverPanelWidth = isVoiceOverPanelOpen ? '25%' : '0%'; // w-1/4
        width = `calc(100% - ${geminiPanelWidth} - ${voiceOverPanelWidth})`;
    }
    return width;
  };


  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-gray-800/50 border-b border-gray-700 p-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-md hover:bg-gray-700 transition-colors"><BackIcon /></button>
          <div className="w-px h-6 bg-gray-600 mx-2"></div>
           {/* View Toggler */}
          <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-md">
            <button onClick={() => setViewMode('editor')} className={`px-3 py-1 text-sm rounded-md ${viewMode === 'editor' ? 'bg-purple-600' : 'hover:bg-gray-700'}`}><PreviewIcon /></button>
            <button onClick={() => setViewMode('code')} className={`px-3 py-1 text-sm rounded-md ${viewMode === 'code' ? 'bg-purple-600' : 'hover:bg-gray-700'}`}><CodeIcon /></button>
          </div>
        </div>

        {viewMode === 'editor' && (
           <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-md">
                <button onClick={() => setDevice('desktop')} className={`p-2 rounded-md ${device === 'desktop' ? 'bg-purple-600' : 'hover:bg-gray-700'}`}><DesktopIcon/></button>
                <button onClick={() => setDevice('tablet')} className={`p-2 rounded-md ${device === 'tablet' ? 'bg-purple-600' : 'hover:bg-gray-700'}`}><TabletIcon/></button>
                <button onClick={() => setDevice('mobile-portrait')} className={`p-2 rounded-md ${device === 'mobile-portrait' ? 'bg-purple-600' : 'hover:bg-gray-700'}`}><MobileIcon/></button>
                <button onClick={() => setDevice('mobile-landscape')} className={`p-2 rounded-md ${device === 'mobile-landscape' ? 'bg-purple-600' : 'hover:bg-gray-700'}`}><LandscapeIcon/></button>
           </div>
        )}

        <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsVoiceOverPanelOpen(!isVoiceOverPanelOpen)} 
              className={`p-2 rounded-md transition-colors flex items-center gap-2 text-sm px-3 py-2 ${isVoiceOverPanelOpen ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              <VoiceOverIcon/> Voice Over
            </button>
            <button onClick={() => setIsDownloadModalOpen(true)} className="p-2 rounded-md hover:bg-gray-600 transition-colors flex items-center gap-2 bg-gray-700 text-sm px-3 py-2"><DownloadIcon/> Download</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-grow overflow-hidden">
        {viewMode === 'editor' && <div className="w-1/3 p-4 bg-gray-800/50 border-r border-gray-700 overflow-y-auto flex-shrink-0"><GeminiPanel onGenerate={handleGenerate} isLoading={isLoading} selectedElement={selectedElement} onCodeChange={handleCodeChange} onDeselect={() => setSelectedElement(null)} /></div>}
        
        <div className="flex-grow flex items-center justify-center p-4 bg-gray-900 overflow-auto transition-all duration-300">
            {viewMode === 'code' ? <CodeView /> : (
                <div 
                    className="bg-gray-800 p-2 rounded-lg shadow-2xl transition-all duration-300 ease-in-out flex items-center justify-center"
                    style={{ width: deviceDimensions[device].width, height: viewMode === 'preview' ? '100%' : deviceDimensions[device].height, maxWidth: '100%', maxHeight: '100%' }}
                >
                    <iframe
                        ref={iframeRef}
                        srcDoc={getFullHtml(code)}
                        title="Presentation Preview"
                        className="w-full h-full bg-white rounded-md border-none"
                        sandbox="allow-scripts allow-same-origin"
                    />
                </div>
            )}
        </div>

        {isVoiceOverPanelOpen && viewMode === 'editor' && (
            <div className="w-1/4 flex-shrink-0 p-4 bg-gray-800/50 border-l border-gray-700 overflow-y-auto transition-all duration-300">
                <VoiceOverPanel 
                    htmlContent={code.html} 
                    onNavigateToSlide={navigateToSlide}
                    onScriptsGenerated={setNarrationScripts}
                    onAudioGenerated={setAudioBlobs}
                />
            </div>
        )}
      </div>
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        code={code}
        logs={geminiLogs}
        narrationScripts={narrationScripts}
        audioBlobs={audioBlobs}
      />
    </div>
  );
};

export default Editor;