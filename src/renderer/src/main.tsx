import './index.css';

import { DocHandle } from '@automerge/automerge-repo';
import { RepoContext } from '@automerge/automerge-repo-react-hooks';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.tsx';
import { repo } from './automerge';
import { DirectoryProvider } from './filesystem';
import { ThemeProvider } from './personalization/theme';

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
