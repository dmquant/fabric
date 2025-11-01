import React, { useState, useEffect } from 'react';

interface GeminiPanelProps {
  onGenerate: (prompt: string) => void;
  isLoading: boolean;
  selectedElement: { selector: string; html: string } | null;
  onCodeChange: (newHtml: string) => void;
  onDeselect: () => void;
}

const LoadingSpinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const GeminiPanel: React.FC<GeminiPanelProps> = ({ onGenerate, isLoading, selectedElement, onCodeChange, onDeselect }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [editedHtml, setEditedHtml] = useState<string>('');

  useEffect(() => {
    if (selectedElement) {
      setEditedHtml(selectedElement.html);
    }
  }, [selectedElement]);

  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedHtml(e.target.value);
  };

  const handleHtmlBlur = () => {
    if (selectedElement && editedHtml !== selectedElement.html) {
      onCodeChange(editedHtml);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onGenerate(prompt);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 mr-2 text-purple-400">
            <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.75.75v13.5a.75.75 0 01-1.5 0V5.25A.75.75 0 019 4.5zm5.803 5.438a.75.75 0 01.285.94l-2.25 3.75a.75.75 0 01-1.276-.758l2.25-3.75a.75.75 0 01.991-.182zM18.75 7.5a.75.75 0 00-1.5 0v9a.75.75 0 001.5 0v-9z" clipRule="evenodd" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-100">Gemini Editor</h2>
      </div>
      <p className="text-gray-400 mb-6 text-sm">
        Click an element to select it, edit its code directly, or describe changes below.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
        {selectedElement && (
            <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-md text-sm">
                <div className="flex justify-between items-center mb-2">
                    <p className="font-bold text-purple-400">Selected Element</p>
                    <button type="button" onClick={onDeselect} title="Deselect" className="text-gray-400 hover:text-white font-bold text-xl leading-none">&times;</button>
                </div>
                <code className="text-purple-300 break-all block mb-2">{selectedElement.selector}</code>
                <label htmlFor="element-html" className="text-gray-300 font-medium mb-1 block text-xs">Element HTML (edit and click away to apply)</label>
                <textarea
                  id="element-html"
                  value={editedHtml}
                  onChange={handleHtmlChange}
                  onBlur={handleHtmlBlur}
                  className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-purple-500 transition-shadow text-gray-200 font-mono text-xs"
                  rows={5}
                />
            </div>
        )}
        <label htmlFor="prompt" className="text-gray-300 font-medium mb-2">Your Request</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'Change the heading to blue and add a section with three feature cards.'"
          className="w-full flex-grow p-3 bg-gray-800 border border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow text-gray-200"
          rows={10}
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="w-full mt-4 flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition-colors duration-200"
        >
          {isLoading ? (
              <>
                <LoadingSpinner />
                Generating...
              </>
          ) : (
            'Generate Code'
          )}
        </button>
      </form>
    </div>
  );
};

export default GeminiPanel;