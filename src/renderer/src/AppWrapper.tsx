import { useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../modules/electron';
import { DirectoryProvider } from '../../modules/filesystem';
import { ThemeProvider } from '../../modules/personalization/theme';
import { Repo, RepoContext } from '../../modules/version-control';
import { setup as setupBrowserRepo } from '../../modules/version-control/repo/browser';
import App from './App.tsx';

export const AppWrapper = () => {
  const { processId } = useContext(ElectronContext);
  const [repo, setRepo] = useState<Repo | null>(null);

  useEffect(() => {
    const setupRepo = async () => {
      if (processId) {
        const repo = await setupBrowserRepo(processId);
        setRepo(repo);
      }
    };

    setupRepo();
  }, [processId]);

  if (!repo) {
    return (
      <div className="flex h-full w-full items-center justify-center text-center">
        Loading...
      </div>
    );
  }

  return (
    <RepoContext.Provider value={repo}>
      <ThemeProvider>
        <DirectoryProvider>
          <App />
        </DirectoryProvider>
      </ThemeProvider>
    </RepoContext.Provider>
  );
};
