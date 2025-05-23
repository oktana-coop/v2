import './App.css';

import { useContext } from 'react';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router';

import { ElectronContext } from '../../modules/electron';
import { VersionControlContext } from '../../modules/version-control/react';
import { Document } from './pages/document/index';
import { History } from './pages/history/index';
import { Options } from './pages/options/Options';

function App() {
  const { isRepoReady } = useContext(VersionControlContext);
  const { isElectron } = useContext(ElectronContext);

  const Router = isElectron ? HashRouter : BrowserRouter;

  if (!isRepoReady) {
    return (
      <div className="flex h-full w-full items-center justify-center text-center">
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Document />} />
        <Route path="/documents" element={<Document />}>
          <Route path=":documentId" element={<Document />} />
        </Route>
        <Route path="/history" element={<History />}>
          <Route path=":documentId" element={<History />}>
            <Route path=":changeId" element={<History />} />
          </Route>
        </Route>
        <Route path="/options" element={<Options />} />
      </Routes>
    </Router>
  );
}

export default App;
