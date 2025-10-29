
import React, { createContext, useState, useContext, ReactNode, FC, useCallback } from 'react';

export type LogEntry = {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: any;
  timestamp: string;
};

export type Asset = {
  data: Blob;
  type: 'text/html' | 'application/json' | 'image/jpeg' | 'audio/wav' | 'text/plain';
};

interface AssetContextType {
  logs: LogEntry[];
  assets: Map<string, Asset>;
  addLog: (level: 'info' | 'warn' | 'error', message: string, context?: any) => void;
  addAsset: (filename: string, data: Blob, type: Asset['type']) => void;
  clearAssetsAndLogs: () => void;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export const AssetProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [assets, setAssets] = useState<Map<string, Asset>>(new Map());

  const addLog = useCallback((level: 'info' | 'warn' | 'error', message: string, context?: any) => {
    const newLog: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };
    setLogs(prevLogs => [...prevLogs, newLog]);
  }, []);

  const addAsset = useCallback((filename: string, data: Blob, type: Asset['type']) => {
    setAssets(prevAssets => {
      const newAssets = new Map(prevAssets);
      newAssets.set(filename, { data, type });
      return newAssets;
    });
  }, []);
  
  const clearAssetsAndLogs = useCallback(() => {
    setLogs([]);
    setAssets(new Map());
    addLog('info', 'Cleared all previous assets and logs.');
  }, [addLog]);

  return (
    <AssetContext.Provider value={{ logs, assets, addLog, addAsset, clearAssetsAndLogs }}>
      {children}
    </AssetContext.Provider>
  );
};

export const useAssets = () => {
  const context = useContext(AssetContext);
  if (context === undefined) {
    throw new Error('useAssets must be used within an AssetProvider');
  }
  return context;
};