import { useContext, useEffect, useState } from 'react';

import {
  browserFilesystemAPIAdapter,
  FilesystemProvider,
} from '../../modules/filesystem';
import { ThemeProvider } from '../../modules/personalization/theme';
import { VersionControlProvider } from '../../modules/version-control/repo/browser';
import App from './App.tsx';

export const AppWrapper = () => {
  return (
    <FilesystemProvider filesystem={browserFilesystemAPIAdapter}>
      <VersionControlProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </VersionControlProvider>
    </FilesystemProvider>
  );
};
