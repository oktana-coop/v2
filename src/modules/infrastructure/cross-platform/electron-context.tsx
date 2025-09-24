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
};

export const ElectronContext = createContext<ElectronContextType>({
  processId: null,
  isElectron: isElectron(),
  openExternalLink: () => {},
  updateState: null,
  downloadUpdate: () => {},
  dismissUpdateNotification: () => {},
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
        console.log('Update available:', updateAvailableState);
        setUpdateState(updateAvailableState);
      });

    const unsubscribeFromUpdateNotAvailable =
      window.electronAPI?.onUpdateNotAvailable((updateNotAvailableState) => {
        console.log('Update not available:', updateNotAvailableState);
        setUpdateState(updateNotAvailableState);
      });

    const unsubscribeFromDownloadUpdateProgress =
      window.electronAPI?.onDownloadUpdateProgress((downloadingUpdateState) => {
        console.log('Downloading update:', downloadingUpdateState);
        setUpdateState(downloadingUpdateState);
      });

    return () => {
      unsubscribeFromUpdateAvailable();
      unsubscribeFromUpdateNotAvailable();
      unsubscribeFromDownloadUpdateProgress();
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

  return (
    <ElectronContext.Provider
      value={{
        processId,
        isElectron: isElectron(),
        openExternalLink: handleOpenExternalLink,
        updateState,
        downloadUpdate: handleDownloadUpdate,
        dismissUpdateNotification: handleDismissUpdateNotification,
      }}
    >
      {children}
    </ElectronContext.Provider>
  );
};
