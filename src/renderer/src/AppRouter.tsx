import './App.css';

import { useContext } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router';

import { ElectronContext } from '../../modules/infrastructure/cross-platform/browser';
import { Layout } from './components/layout/Layout';
import {
  CompareContentConflictResolution,
  CurrentProject,
  DocumentEditor,
  DocumentHistoricalView,
  DocumentSelection,
  HistoryNoProject,
  ProjectDocuments,
  ProjectHistory,
  ProjectHistoryDocumentView,
  ProjectMergeConflictResolution,
  ProjectProviders,
  ProjectSelection,
  ProjectSettings,
  StructuralConflictResolution,
} from './pages/project';
import {
  AppearanceSettings,
  GeneralSettings,
  Settings,
  SyncSettings,
} from './pages/settings';

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
              <Route path="documents" element={<ProjectDocuments />}>
                <Route index element={<DocumentSelection />} />
                <Route path=":documentId">
                  <Route index element={<DocumentEditor />} />
                  <Route
                    path="changes/:changeId"
                    element={<DocumentHistoricalView />}
                  />
                </Route>
              </Route>
              <Route path="merge" element={<ProjectMergeConflictResolution />}>
                <Route
                  path="structural"
                  element={<StructuralConflictResolution />}
                />
                <Route
                  path=":compareContentPath"
                  element={<CompareContentConflictResolution />}
                />
              </Route>
              <Route path="history" element={<ProjectHistory />}>
                <Route
                  path=":documentId/changes/:changeId"
                  element={<ProjectHistoryDocumentView />}
                />
              </Route>
              <Route path="settings" element={<ProjectSettings />} />
            </Route>
          </Route>
          <Route path="/history" element={<HistoryNoProject />} />
          <Route path="/settings" element={<Settings />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<GeneralSettings />} />
            <Route path="sync" element={<SyncSettings />} />
            <Route path="appearance" element={<AppearanceSettings />} />
          </Route>
        </Routes>
      </Layout>
    </Router>
  );
};
