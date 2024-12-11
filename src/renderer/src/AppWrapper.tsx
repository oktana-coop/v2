import { useContext } from 'react';

import { ElectronContext } from '../../modules/electron';
import {
  createBrowserFilesystemAPIAdapter,
  createElectronRendererFilesystemAPIAdapter,
  FilesystemProvider,
} from '../../modules/filesystem';
import { ThemeProvider } from '../../modules/personalization/theme';
import { VersionControlProvider } from '../../modules/version-control/react';
import App from './App.tsx';

export const AppWrapper = () => {
  const { isElectron } = useContext(ElectronContext);

  return (
    <FilesystemProvider
      filesystem={
        isElectron
          ? createElectronRendererFilesystemAPIAdapter()
          : createBrowserFilesystemAPIAdapter()
      }
    >
      <VersionControlProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </VersionControlProvider>
    </FilesystemProvider>
  );
};
