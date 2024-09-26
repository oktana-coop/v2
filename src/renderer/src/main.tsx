import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import { DirectoryProvider } from '../../modules/filesystem/index.ts';
import { ThemeProvider } from '../../modules/personalization/theme/index.ts';
import { RepoContext } from '../../modules/version-control/index.ts';
import App from './App.tsx';

const repo = await window.electronAPI.setupVersionControlRepo();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RepoContext.Provider value={repo}>
      <ThemeProvider>
        <DirectoryProvider>
          <App />
        </DirectoryProvider>
      </ThemeProvider>
    </RepoContext.Provider>
  </React.StrictMode>
);
