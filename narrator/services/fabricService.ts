
import { LogEntry } from "../contexts/AssetContext";

type SessionResponse = {
  sessionId: string;
};

export const createSession = async (baseUrl: string, token: string, appName: string, metadata: any): Promise<SessionResponse> => {
  const response = await fetch(`${baseUrl}/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ appName, metadata }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Fabric API Error (createSession): ${response.status} ${errorBody}`);
  }
  return response.json();
};

export const appendLogs = async (baseUrl: string, token: string, sessionId: string, logs: LogEntry[]) => {
    // Fabric API expects entries without timestamp
    const entries = logs.map(({ timestamp, ...rest }) => rest);
    if(entries.length === 0) return;
    
    const response = await fetch(`${baseUrl}/sessions/${sessionId}/logs`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Fabric API Error (appendLogs): ${response.status} ${errorBody}`);
    }
};

export const uploadAssets = async (baseUrl: string, token: string, sessionId: string, zipBlob: Blob) => {
    const response = await fetch(`${baseUrl}/sessions/${sessionId}/assets`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/zip',
        },
        body: zipBlob,
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Fabric API Error (uploadAssets): ${response.status} ${errorBody}`);
    }
};
