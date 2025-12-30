import { createContext, useEffect, useState } from 'react';

import {
  config as browserBuildConfig,
  type RendererConfig,
} from '../../../config/browser';
import { isElectron } from '../browser-env';
import { type UpdateState } from '../update';

type ElectronContextType = {
  processId: string | null;
  isElectron: boolean;
  openExternalLink: (url: string) => void;
  updateState: UpdateState | null;
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
  isElectron: isElectron(),
  openExternalLink: () => {},
  updateState: null,
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
  const config: RendererConfig = isElectron()
    ? window.config
    : browserBuildConfig;
  const isMac = isElectron() && window.electronAPI.isMac;
  const isWindows = isElectron() && window.electronAPI.isWindows;
  const isLinux = isElectron() && window.electronAPI.isLinux;

  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.onReceiveProcessId((processId: string) => {
        setProcessId(processId);
      });
    }

    const unsubscribeFromUpdateStateChange =
      window.electronAPI?.onUpdateStateChange((updateState) => {
        setUpdateState(updateState);
      });

    return () => {
      unsubscribeFromUpdateStateChange?.();
    };
  }, []);

  const handleOpenExternalLink = (url: string) => {
    if (url) {
      if (isElectron()) {
        window.electronAPI.openExternalLink(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleDismissUpdateNotification = () => {
    setUpdateState(null);
  };

  const handleCheckForUpdate = () => {
    if (isElectron()) {
      window.electronAPI.checkForUpdate();
    }
  };

  const handleDownloadUpdate = () => {
    if (isElectron()) {
      window.electronAPI.downloadUpdate();
    }
  };

  const handleRestartToInstallUpdate = () => {
    if (isElectron()) {
      window.electronAPI.restartToInstallUpdate();
    }
  };

  return (
    <ElectronContext.Provider
      value={{
        processId,
        isElectron: isElectron(),
        openExternalLink: handleOpenExternalLink,
        updateState,
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
