import { useContext } from 'react';

import { ElectronContext } from '../../modules/electron';
import {
  createBrowserFilesystemAPIAdapter,
  createElectronRendererFilesystemAPIAdapter,
  FilesystemProvider,
} from '../../modules/filesystem';
import { FunctionalityConfigProvider } from '../../modules/personalization/functionality-config';
import { ThemeProvider } from '../../modules/personalization/theme';
import { VersionControlProvider } from '../../modules/version-control/react';
import { WasmProvider } from '../../modules/wasm';
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
      <WasmProvider>
        <VersionControlProvider>
          <ThemeProvider>
            <FunctionalityConfigProvider>
              <App />
            </FunctionalityConfigProvider>
          </ThemeProvider>
        </VersionControlProvider>
      </WasmProvider>
    </FilesystemProvider>
  );
};
