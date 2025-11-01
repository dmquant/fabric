export interface PresentationAssets {
  html: string;
  css: string;
  js: string;
  narrations: string[];
  audios: { name: string; blob: Blob }[];
}

export enum TrackStatus {
  PENDING = 'Pending',
  RECORDING = 'Recording',
  COMPLETED = 'Completed',
  ERROR = 'Error',
}

export interface Track {
  slideNumber: number;
  narration: string;
  audioBlob: Blob;
  videoBlob: Blob | null;
  duration: number;
  status: TrackStatus;
  thumbnailUrl: string | null;
}
