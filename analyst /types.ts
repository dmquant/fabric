export interface ReportData {
  markdown: string;
  htmlFiles: { name: string; content: string }[];
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export type TaskType = 'meta' | 'data-gathering' | 'research';

export interface Task {
  id: string;
  parentId: string | null;
  type: TaskType;
  description: string;
  status: TaskStatus;
  result: string | null;
  error: string | null;
  startTime?: number;
  endTime?: number;
}
