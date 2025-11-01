import React, { useState } from 'react';
import { generateSlides } from '../services/geminiService';
import { GeminiIcon, LoadingSpinner, TemplateIcon, UploadIcon } from './icons';
import { sample } from './sample-presentation';

interface CreationPanelProps {
  onGenerate: (html: string, css: string, js: string) => void;
}

const templates = [
  {
    id: 'professional',
    name: 'Professional',
    preview: {
      bg: 'bg-white',
      heading: 'text-blue-900',
      text: 'text-gray-600',
      accent: 'bg-blue-600',
    },
  },
  {
    id: 'creative',
    name: 'Creative',
    preview: {
      bg: 'bg-gray-800',
      heading: 'text-amber-300',
      text: 'text-gray-300',
      accent: 'bg-rose-500',
    },
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    preview: {
      bg: 'bg-gray-100',
      heading: 'text-gray-800',
      text: 'text-gray-500',
      accent: 'bg-gray-800',
    },
  },
  {
    id: 'tech',
    name: 'Tech',
    preview: {
      bg: 'bg-gray-900',
      heading: 'text-cyan-400',
      text: 'text-gray-400',
      accent: 'bg-fuchsia-500',
    },
  },
  {
    id: 'academic',
    name: 'Academic',
     preview: {
      bg: 'bg-stone-100',
      heading: 'text-stone-800 font-serif',
      text: 'text-stone-600',
      accent: 'bg-red-900',
    },
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    preview: {
      bg: 'bg-white',
      heading: 'text-orange-600',
      text: 'text-gray-700',
      accent: 'bg-teal-400',
    },
  },
];


const CreationPanel: React.FC<CreationPanelProps> = ({ onGenerate }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [template, setTemplate] = useState<string>('professional');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPrompt(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleTryDemo = () => {
    onGenerate(sample.html, sample.css, sample.js);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      setIsLoading(true);
      setError(null);
      try {
        const { html, css, js } = await generateSlides(prompt, template);
        onGenerate(html, css, js);
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred during generation.');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-8">
            <GeminiIcon />
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mt-4">Create Your Presentation</h1>
            <p className="text-gray-400 mt-2 text-lg">Describe your slides, or upload a document, and let AI build your deck.</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="prompt" className="block text-lg font-medium text-gray-300 mb-2">Your Content or Prompt</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., 'Create a 5-slide presentation about the benefits of renewable energy. Include a title slide, an introduction, a slide with a bar chart comparing solar and wind, a summary, and a thank you slide.'"
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md resize-y min-h-[150px] focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow text-gray-200"
                rows={6}
              />
            </div>

            <div className="flex items-center justify-center mb-6">
                <span className="h-px flex-1 bg-gray-600"></span>
                <span className="px-4 text-gray-400 font-semibold">OR</span>
                <span className="h-px flex-1 bg-gray-600"></span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 px-4 rounded-md transition-colors duration-200 flex items-center justify-center w-full">
                    <UploadIcon />
                    <span className="ml-2">Upload a Text File</span>
                </label>
                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".txt,.md" onChange={handleFileChange} />
                <button type="button" onClick={handleTryDemo} className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 px-4 rounded-md transition-colors duration-200 flex items-center justify-center w-full">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2"><path d="M10 3.75a2 2 0 100 4 2 2 0 000-4zM4.332 9.5a2.5 2.5 0 013.336-1.547 3.5 3.5 0 014.664 0A2.5 2.5 0 0115.668 9.5V13a2.5 2.5 0 01-2.5 2.5h-1.332a3.5 3.5 0 01-4.664 0H5.832A2.5 2.5 0 013.332 13V9.5z"></path></svg>
                    <span>Try a Demo</span>
                </button>
            </div>


            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-300 mb-3 flex items-center"><TemplateIcon /> <span className="ml-2">Choose a Template</span></h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`text-center transition-all duration-200 border-2 rounded-lg overflow-hidden
                      ${template === t.id ? 'border-purple-500 scale-105' : 'border-gray-600 hover:border-gray-500 bg-gray-700'}
                    `}
                  >
                    <div className={`px-2 py-4 h-24 ${t.preview.bg} flex flex-col justify-center items-center`}>
                        <div className={`font-bold text-xs ${t.preview.heading}`}>Title Here</div>
                        <div className={`h-0.5 w-8 my-1 ${t.preview.accent}`}></div>
                        <div className={`h-1 w-10 my-0.5 ${t.preview.accent} opacity-50`}></div>
                    </div>
                    <div className="p-2 bg-gray-700">
                      <span className="font-semibold text-sm text-gray-200">{t.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/50 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-md transition-colors duration-200 text-lg"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  Generating Slides...
                </>
              ) : (
                'Generate Slides'
              )}
            </button>
            {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreationPanel;