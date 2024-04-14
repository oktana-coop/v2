import * as A from '@automerge/automerge';
import { AutomergeUrl } from '@automerge/automerge-repo';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

import { DocHandle, isValidAutomergeUrl } from '@automerge/automerge-repo';
import './index.css';

import { RepoContext } from '@automerge/automerge-repo-react-hooks';
import { repo } from './automerge';
import { ThemeProvider } from './personalization/theme';

const persistDocumentUrl = (docUrl: AutomergeUrl) => {
  const currentDocUrls = localStorage.getItem('docUrls');
  if (currentDocUrls) {
    const currentDocs = JSON.parse(currentDocUrls);
    localStorage.setItem(
      'docUrls',
      JSON.stringify({
        ...currentDocs,
        [docUrl]: docUrl,
      })
    );
  } else {
    localStorage.setItem(
      'docUrls',
      JSON.stringify({
        [docUrl]: docUrl,
      })
    );
  }
};

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
  handle = repo.create<{ doc?: A.Doc<string> }>();
  handle.change((d) => (d.doc = ''));
}
const docUrl = handle.url;
// temporary solution to persist the document URLs
persistDocumentUrl(docUrl);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RepoContext.Provider value={repo}>
      <ThemeProvider>
        <App docUrl={docUrl} />
      </ThemeProvider>
    </RepoContext.Provider>
  </React.StrictMode>
);
