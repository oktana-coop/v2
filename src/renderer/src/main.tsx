import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

import { DocHandle } from '@automerge/automerge-repo';
import './index.css';

import { RepoContext } from '@automerge/automerge-repo-react-hooks';
import { repo } from './automerge';
import { ThemeProvider } from './personalization/theme';
import { DirectoryProvider } from './filesystem';

declare global {
  interface Window {
    handle: DocHandle<unknown>;
  }
}

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
