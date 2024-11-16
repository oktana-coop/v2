import { useContext } from 'react';

import { ElectronContext } from '../../modules/electron';
import {
  browserFilesystemAPIAdapter,
  electronRendererFilesystemAPIAdapter,
  FilesystemProvider,
} from '../../modules/filesystem';
import { ThemeProvider } from '../../modules/personalization/theme';
import { VersionControlProvider } from '../../modules/version-control/repo/browser';
import App from './App.tsx';

export const AppWrapper = () => {
  const { isElectron } = useContext(ElectronContext);

  return (
    <FilesystemProvider
      filesystem={
        isElectron
          ? electronRendererFilesystemAPIAdapter
          : browserFilesystemAPIAdapter
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
