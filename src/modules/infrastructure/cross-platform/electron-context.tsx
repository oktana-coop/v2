import { createContext, useEffect, useState } from 'react';

import { isElectron } from './utils';

type ElectronContextType = {
  processId: string | null;
  isElectron: boolean;
  openExternalLink: (url: string) => void;
};

export const ElectronContext = createContext<ElectronContextType>({
  processId: null,
  isElectron: isElectron(),
  openExternalLink: () => {},
});

export const ElectronProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [processId, setProcessId] = useState<string | null>(null);

  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.onReceiveProcessId((processId: string) => {
        setProcessId(processId);
      });
    }
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

  return (
    <ElectronContext.Provider
      value={{
        processId,
        isElectron: isElectron(),
        openExternalLink: handleOpenExternalLink,
      }}
    >
      {children}
    </ElectronContext.Provider>
  );
};
