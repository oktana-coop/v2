import './App.css';

import { useContext } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router';

import { ElectronContext } from '../../modules/infrastructure/cross-platform';
import {
  DocumentEditor,
  DocumentHistoricalView,
  Project,
} from './pages/document';
import { Options } from './pages/options/Options';

function App() {
  const { isElectron } = useContext(ElectronContext);

  const Router = isElectron ? MemoryRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<Project />}>
          <Route path=":projectId/documents/:documentId">
            <Route index element={<DocumentEditor />} />
            <Route
              path="changes/:changeId"
              element={<DocumentHistoricalView />}
            />
          </Route>
        </Route>
        <Route path="/options" element={<Options />} />
      </Routes>
    </Router>
  );
}

export default App;
