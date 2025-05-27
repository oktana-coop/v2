import { FilesystemProvider } from '../../modules/filesystem/react/filesystem-context';
import { FunctionalityConfigProvider } from '../../modules/personalization/functionality-config';
import { ThemeProvider } from '../../modules/personalization/theme';
import { VersionControlProvider } from '../../modules/version-control/react';
import { WasmProvider } from '../../modules/wasm';
import App from './App.tsx';

export const AppWrapper = () => {
  return (
    <FilesystemProvider>
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
