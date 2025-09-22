import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import { ElectronProvider } from '../../modules/infrastructure/cross-platform';
import { type File } from '../../modules/infrastructure/filesystem';
import { AppWrapper } from './AppWrapper';

// Listen for files opened from the OS and store them in session storage
// to be picked up by the relevant project context
// This is necessary because the context may not be mounted yet when the event is received
window.osEventsAPI.onOpenFileFromFilesystem((file: File) => {
  sessionStorage.setItem('fileToBeOpened', JSON.stringify(file));
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ElectronProvider>
      <AppWrapper />
    </ElectronProvider>
  </React.StrictMode>
);
