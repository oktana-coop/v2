import './App.css';

import { useContext } from 'react';
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router';

import { ElectronContext } from '../../modules/electron';
import { VersionControlContext } from '../../modules/version-control/react';
import {
  Document,
  DocumentEditor,
  DocumentHistoricalView,
} from './pages/document';
import { Options } from './pages/options/Options';
import { ProjectHistory } from './pages/project-history';

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
        <Route path="/" element={<Navigate to="/documents" replace />} />
        <Route path="/documents" element={<Document />}>
          <Route path=":documentId">
            <Route index element={<DocumentEditor />} />
            <Route
              path="changes/:changeId"
              element={<DocumentHistoricalView />}
            />
          </Route>
        </Route>
        <Route path="/history" element={<ProjectHistory />} />
        <Route path="/options" element={<Options />} />
      </Routes>
    </Router>
  );
}

export default App;
