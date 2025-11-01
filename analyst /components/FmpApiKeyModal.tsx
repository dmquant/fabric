import React, { useState } from 'react';

interface FmpApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  isPendingAnalysis: boolean;
}

const FmpApiKeyModal: React.FC<FmpApiKeyModalProps> = ({ isOpen, onClose, onSave, isPendingAnalysis }) => {
  const [apiKey, setApiKey] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    if (apiKey.trim()) {
      onSave(apiKey.trim());
      setApiKey('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-white">Enter FMP API Key</h2>
        <p className="text-slate-400 mb-6">
          To use automated data gathering, please provide your API key from{' '}
          <a href="https://site.financialmodelingprep.com/developer/docs" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Financial Modeling Prep
          </a>
          . Your key will be used for this session and will not be stored.
        </p>
        <div>
          <label htmlFor="fmp-api-key" className="block text-sm font-medium text-slate-300 mb-2">
            Your FMP API Key
          </label>
          <input
            id="fmp-api-key"
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Enter your API key here"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>
        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-semibold text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-slate-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {isPendingAnalysis ? 'Save & Analyze' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FmpApiKeyModal;