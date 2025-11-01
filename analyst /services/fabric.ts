import { Task } from '../types';

interface SessionMetadata {
  runId: string;
  inputSummary: string;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

const handleApiResponse = async (response: Response) => {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage = errorBody.message || 'An unknown error occurred';
        throw new Error(`Fabric API Error (${response.status}): ${errorMessage}`);
    }
    // For POST requests that don't return a body on success
    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
        return null;
    }
    return response.json();
};


export const createSession = async (
  baseUrl: string,
  token: string,
  appName: string,
  metadata: SessionMetadata
): Promise<{ sessionId: string }> => {
  const response = await fetch(`${baseUrl}/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ appName, metadata }),
  });
  // Per docs, successful creation is 201
  if (response.status !== 201) {
     const errorBody = await response.json().catch(() => ({ message: response.statusText }));
     throw new Error(`Fabric API Error (${response.status}): Failed to create session. ${errorBody.message || 'Unknown error'}`);
  }
  return response.json();
};

export const appendLogs = async (
  baseUrl: string,
  token: string,
  sessionId: string,
  entries: LogEntry[]
): Promise<void> => {
   const response = await fetch(`${baseUrl}/sessions/${sessionId}/logs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ entries }),
  });
  await handleApiResponse(response);
};

export const uploadAssets = async (
  baseUrl: string,
  token: string,
  sessionId: string,
  zipBlob: Blob
): Promise<void> => {
   const response = await fetch(`${baseUrl}/sessions/${sessionId}/assets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/zip',
    },
    body: zipBlob,
  });
   await handleApiResponse(response);
};

// Helper to convert tasks to log entries
export const tasksToLogEntries = (tasks: Task[]): LogEntry[] => {
    const entries: LogEntry[] = [];
    if (!tasks || tasks.length === 0) return entries;
    
    const taskMap = new Map(tasks.map(t => [t.id, { ...t, children: [] as Task[] }]));
    const roots: Task[] = [];
    
    tasks.forEach(task => {
        if (task.parentId && taskMap.has(task.parentId)) {
            const parent = taskMap.get(task.parentId);
            if (parent) {
                parent.children.push(task);
            }
        } else {
            roots.push(task);
        }
    });

    const buildLogs = (task: Task) => {
        let level: LogEntry['level'] = 'info';
        if (task.status === 'failed') level = 'error';

        const context: Record<string, any> = {
            id: task.id,
            type: task.type,
            status: task.status,
            parentId: task.parentId,
        };
        if (task.startTime) context.startTime = new Date(task.startTime).toISOString();
        if (task.endTime) {
            context.endTime = new Date(task.endTime).toISOString();
            if (task.startTime) {
                 context.duration_ms = task.endTime - task.startTime;
            }
        }
        
        entries.push({
            level,
            message: `Task '${task.description}' finished with status: ${task.status}.`,
            context,
        });

        if (task.error) {
            entries.push({
                level: 'error',
                message: `Error in task '${task.description}': ${task.error}`,
                context: { parentTaskId: task.id },
            });
        }
        
        const children = taskMap.get(task.id)?.children || [];
        children.sort((a,b) => (a.startTime || 0) - (b.startTime || 0)).forEach(buildLogs);
    };

    roots.sort((a,b) => (a.startTime || 0) - (b.startTime || 0)).forEach(buildLogs);
    return entries;
};
