import React, { useState } from 'react';
import CreationPanel from './components/CreationPanel';
import Editor from './components/Editor';

const App: React.FC = () => {
  const [code, setCode] = useState<{ html: string; css: string; js: string } | null>(null);

  const handleGenerate = (html: string, css: string, js: string) => {
    setCode({ html, css, js });
  };
  
  const handleBack = () => {
    setCode(null);
  }

  if (!code) {
    return <CreationPanel onGenerate={handleGenerate} />;
  }

  return <Editor initialCode={code} onBack={handleBack} />;
};

export default App;