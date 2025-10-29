
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { AssetProvider } from './contexts/AssetContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AssetProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AssetProvider>
  </React.StrictMode>
);