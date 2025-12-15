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
import { Layout } from './components/layout/Layout';
import { LocationLogger } from './dev-utils/location-logger';
import { Options } from './pages/options/Options';
import {
  CurrentProject,
  DocumentEditor,
  DocumentHistoricalView,
  DocumentSelection,
  ProjectProviders,
  ProjectSelection,
  ProjectSettings,
} from './pages/project';

export const AppRouter = () => {
  const { isElectron } = useContext(ElectronContext);

  const Router = isElectron ? MemoryRouter : BrowserRouter;

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectProviders />}>
            <Route index element={<ProjectSelection />} />
            <Route path=":projectId" element={<CurrentProject />}>
              <Route path="documents">
                <Route index element={<DocumentSelection />} />
                <Route path=":documentId">
                  <Route index element={<DocumentEditor />} />
                  <Route
                    path="changes/:changeId"
                    element={<DocumentHistoricalView />}
                  />
                </Route>
              </Route>
              <Route path="settings" element={<ProjectSettings />} />
            </Route>
          </Route>
          <Route path="/options" element={<Options />} />
        </Routes>
        <LocationLogger />
      </Layout>
    </Router>
  );
};
