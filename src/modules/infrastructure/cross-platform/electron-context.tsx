import { createContext, useEffect, useState } from 'react';

import { type UpdateState } from '../cross-platform/update';
import { isElectron } from './utils';

type ElectronContextType = {
  processId: string | null;
  isElectron: boolean;
  openExternalLink: (url: string) => void;
  updateState: UpdateState | null;
  downloadUpdate: () => void;
  dismissUpdateNotification: () => void;
  restartToInstallUpdate: () => void;
};

export const ElectronContext = createContext<ElectronContextType>({
  processId: null,
  isElectron: isElectron(),
  openExternalLink: () => {},
  updateState: null,
  downloadUpdate: () => {},
  dismissUpdateNotification: () => {},
  restartToInstallUpdate: () => {},
});

export const ElectronProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [processId, setProcessId] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);

  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.onReceiveProcessId((processId: string) => {
        setProcessId(processId);
      });
    }

    const unsubscribeFromUpdateAvailable =
      window.electronAPI?.onUpdateAvailable((updateAvailableState) => {
        setUpdateState(updateAvailableState);
      });

    const unsubscribeFromUpdateNotAvailable =
      window.electronAPI?.onUpdateNotAvailable((updateNotAvailableState) => {
        setUpdateState(updateNotAvailableState);
      });

    const unsubscribeFromDownloadUpdateProgress =
      window.electronAPI?.onDownloadUpdateProgress((downloadingUpdateState) => {
        setUpdateState(downloadingUpdateState);
      });

    const unsubscribeFromDownloadCompleted =
      window.electronAPI?.onDownloadCompleted((downloadCompletedState) => {
        setUpdateState(downloadCompletedState);
      });

    return () => {
      unsubscribeFromUpdateAvailable();
      unsubscribeFromUpdateNotAvailable();
      unsubscribeFromDownloadUpdateProgress();
      unsubscribeFromDownloadCompleted();
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
        downloadUpdate: handleDownloadUpdate,
        dismissUpdateNotification: handleDismissUpdateNotification,
        restartToInstallUpdate: () => handleRestartToInstallUpdate(),
      }}
    >
      {children}
    </ElectronContext.Provider>
  );
};
