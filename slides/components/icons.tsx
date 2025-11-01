import React from 'react';

export const GeminiIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 mx-auto text-purple-400">
        <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.75.75v13.5a.75.75 0 01-1.5 0V5.25A.75.75 0 019 4.5zm5.803 5.438a.75.75 0 01.285.94l-2.25 3.75a.75.75 0 01-1.276-.758l2.25-3.75a.75.75 0 01.991-.182zM18.75 7.5a.75.75 0 00-1.5 0v9a.75.75 0 001.5 0v-9z" clipRule="evenodd" />
    </svg>
);

export const LoadingSpinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export const TemplateIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400">
        <path d="M5.25 3A2.25 2.25 0 003 5.25v9.5A2.25 2.25 0 005.25 17h9.5A2.25 2.25 0 0017 14.75v-9.5A2.25 2.25 0 0014.75 3h-9.5zM3.75 5.25c0-.83.67-1.5 1.5-1.5h9.5c.83 0 1.5.67 1.5 1.5v2.5h-12.5v-2.5zM16.25 9v5.75c0 .83-.67 1.5-1.5 1.5h-9.5c-.83 0-1.5-.67-1.5-1.5V9h12.5z" />
    </svg>
);

export const UploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M9.25 11.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v3.19l1.97-1.97a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l1.97 1.97V11.5z" />
        <path d="M6.541 4.54a.75.75 0 00.166 1.054L9.5 8.5h1l2.793-2.906a.75.75 0 10-1.054-1.054L10 6.636 7.601 4.24a.75.75 0 00-1.06-.3z" />
        <path fillRule="evenodd" d="M3 6a3 3 0 013-3h8a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm3-1.5a1.5 1.5 0 00-1.5 1.5v8a1.5 1.5 0 001.5 1.5h8a1.5 1.5 0 001.5-1.5V6A1.5 1.5 0 0014 4.5H6z" clipRule="evenodd" />
    </svg>
);

export const BackIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

export const PreviewIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.18l.88-1.224a1.65 1.65 0 00-.539-2.296l-1.037-.714a1.65 1.65 0 01-.54-2.295l.88-1.225a1.65 1.65 0 00.539-2.296L.879 3.14A1.65 1.65 0 012.6 2.37l1.224.88a1.65 1.65 0 002.296-.539l.714-1.037a1.65 1.65 0 012.295-.54l1.225.88a1.65 1.65 0 002.296.539l1.037-.714a1.65 1.65 0 012.295.54l-.88 1.224a1.65 1.65 0 00-.539 2.296l1.037.714a1.65 1.65 0 01.54 2.295l-.88 1.225a1.65 1.65 0 00.539 2.296l.879 1.43a1.65 1.65 0 01-1.72 2.723l-1.224-.88a1.65 1.65 0 00-2.296.539l-.714 1.037a1.65 1.65 0 01-2.295.54l-1.225-.88a1.65 1.65 0 00-2.296-.539l-1.037.714a1.65 1.65 0 01-2.295-.54l.88-1.224a1.65 1.65 0 00.539-2.296L.664 10.59zM10 15.5a5.5 5.5 0 100-11 5.5 5.5 0 000 11z" clipRule="evenodd" /></svg>
);

export const CodeIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M6.28 5.22a.75.75 0 010 1.06L2.56 10l3.72 3.72a.75.75 0 01-1.06 1.06L.97 10.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0zm7.44 0a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 010-1.06zM11.378 2.011a.75.75 0 01.612.868l-2.5 14.5a.75.75 0 01-1.48-.256l2.5-14.5a.75.75 0 01.868-.612z" clipRule="evenodd" /></svg>
);

export const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>
);

export const DesktopIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M2 5a3 3 0 013-3h10a3 3 0 013 3v6a3 3 0 01-3 3H5a3 3 0 01-3-3V5zm1.5 0a1.5 1.5 0 011.5-1.5h10a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H5a1.5 1.5 0 01-1.5-1.5V5z" clipRule="evenodd" /><path d="M3 16.5a.5.5 0 01.5-.5h13a.5.5 0 010 1H3.5a.5.5 0 01-.5-.5z" /></svg>
);

export const TabletIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M6 2a3 3 0 00-3 3v10a3 3 0 003 3h8a3 3 0 003-3V5a3 3 0 00-3-3H6zm.5 1.5a.5.5 0 00-.5.5v10a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V5a.5.5 0 00-.5-.5H6.5z" clipRule="evenodd" /></svg>
);

export const MobileIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M7 2a3 3 0 00-3 3v10a3 3 0 003 3h6a3 3 0 003-3V5a3 3 0 00-3-3H7zm.5 1.5a.5.5 0 00-.5.5v10a.5.5 0 00.5.5h6a.5.5 0 00.5-.5V5a.5.5 0 00-.5-.5H7.5z" clipRule="evenodd" /></svg>
);

export const PortraitIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M7 2a3 3 0 00-3 3v10a3 3 0 003 3h6a3 3 0 003-3V5a3 3 0 00-3-3H7zm.5 1.5a.5.5 0 00-.5.5v10a.5.5 0 00.5.5h6a.5.5 0 00.5-.5V5a.5.5 0 00-.5-.5H7.5z" clipRule="evenodd" /></svg>
);

export const LandscapeIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M2 7a3 3 0 013-3h10a3 3 0 013 3v6a3 3 0 01-3 3H5a3 3 0 01-3-3V7zm1.5.5a.5.5 0 01.5-.5h10a.5.5 0 01.5.5v6a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5V7.5z" clipRule="evenodd" /></svg>
);

export const VoiceOverIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" /><path d="M5.5 4.5a.5.5 0 00-1 0v7a4.5 4.5 0 109 0v-7a.5.5 0 00-1 0v7a3.5 3.5 0 11-7 0v-7z" /></svg>
);

export const CloudUploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.97 2.97a.75.75 0 001.06-1.06l-4.25-4.25a.75.75 0 00-1.06 0L5.22 6.546a.75.75 0 101.06 1.06l2.97-2.97v8.614z" />
        <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
    </svg>
);

export const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
);