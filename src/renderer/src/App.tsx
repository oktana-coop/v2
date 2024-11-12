import './App.css';

import { useContext } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { VersionControlContext } from '../../modules/version-control/repo/browser';
import { Editor } from './pages/editor/index';
import { History } from './pages/history/index';
import { Options } from './pages/options/Options';

function App() {
  const { isRepoReady } = useContext(VersionControlContext);

  if (!isRepoReady) {
    return (
      <div className="flex h-full w-full items-center justify-center text-center">
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Editor />} />
        <Route path="/edit" element={<Editor />}>
          <Route path=":documentId" element={<Editor />} />
        </Route>
        <Route path="history" element={<History />}>
          <Route path=":documentId" element={<History />} />
        </Route>
        <Route path="/options" element={<Options />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
