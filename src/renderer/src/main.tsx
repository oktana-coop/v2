import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import * as A from '@automerge/automerge';

import './index.css';
import { isValidAutomergeUrl, DocHandle } from '@automerge/automerge-repo';

import { RepoContext } from '@automerge/automerge-repo-react-hooks';
import { ThemeProvider } from './personalization/theme';
import { repo } from './automerge';

declare global {
  interface Window {
    handle: DocHandle<unknown>;
  }
}

const queryParams = new URLSearchParams(window.location.search);
const rootDocUrl = queryParams.get('docUrl');

let handle;
if (isValidAutomergeUrl(rootDocUrl)) {
  handle = repo.find(rootDocUrl);
} else {
  handle = repo.create<{ counter?: A.Counter }>();
  handle.change((d) => (d.counter = new A.Counter()));
}
const docUrl = handle.url;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RepoContext.Provider value={repo}>
      <ThemeProvider>
        <App docUrl={docUrl} />
      </ThemeProvider>
    </RepoContext.Provider>
  </React.StrictMode>
);
