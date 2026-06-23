import { createContext, useEffect, useState } from 'react';

import { type RendererConfig } from '../../../config/browser';
import { type UpdateState } from '../update';

type ElectronContextType = {
  processId: string | null;
  openExternalLink: (url: string) => void;
  updateState: UpdateState | null;
  userInitiatedUpdateCheck: boolean;
  checkForUpdate: () => void;
  downloadUpdate: () => void;
  dismissUpdateNotification: () => void;
  restartToInstallUpdate: () => void;
  config: RendererConfig;
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
};

export const ElectronContext = createContext<ElectronContextType>({
  processId: null,
  openExternalLink: () => {},
  updateState: null,
  userInitiatedUpdateCheck: false,
  checkForUpdate: () => {},
  downloadUpdate: () => {},
  dismissUpdateNotification: () => {},
  restartToInstallUpdate: () => {},
  // @ts-expect-error will get overriden below
  config: null,
});

export const ElectronProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [processId, setProcessId] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [userInitiatedUpdateCheck, setUserInitiatedUpdateCheck] =
    useState(false);
  const config: RendererConfig = window.config;
  const isMac = window.electronAPI.isMac;
  const isWindows = window.electronAPI.isWindows;
  const isLinux = window.electronAPI.isLinux;

  useEffect(() => {
    window.electronAPI.onReceiveProcessId((processId: string) => {
      setProcessId(processId);
    });

    const unsubscribeFromUpdateStateChange =
      window.electronAPI.onUpdateStateChange((updateState) => {
        setUpdateState(updateState);
      });

    const checkForUpdateOnStartup = async () => {
      try {
        await window.electronAPI.checkForUpdate();
      } catch (error) {
        console.error('Startup update check failed:', error);
      }
    };

    if (!window.electronAPI.isLinux) {
      checkForUpdateOnStartup();
    }

    return () => {
      unsubscribeFromUpdateStateChange?.();
    };
  }, []);

  const handleOpenExternalLink = (url: string) => {
    if (url) {
      window.electronAPI.openExternalLink(url);
    }
  };

  const handleDismissUpdateNotification = () => {
    setUpdateState(null);
  };

  const handleCheckForUpdate = () => {
    setUserInitiatedUpdateCheck(true);
    window.electronAPI.checkForUpdate();
  };

  const handleDownloadUpdate = () => {
    window.electronAPI.downloadUpdate();
  };

  const handleRestartToInstallUpdate = () => {
    window.electronAPI.restartToInstallUpdate();
  };

  return (
    <ElectronContext.Provider
      value={{
        processId,
        openExternalLink: handleOpenExternalLink,
        updateState,
        userInitiatedUpdateCheck,
        checkForUpdate: handleCheckForUpdate,
        downloadUpdate: handleDownloadUpdate,
        dismissUpdateNotification: handleDismissUpdateNotification,
        restartToInstallUpdate: () => handleRestartToInstallUpdate(),
        config,
        isMac,
        isWindows,
        isLinux,
      }}
    >
      {children}
    </ElectronContext.Provider>
  );
};
