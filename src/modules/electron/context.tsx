import { createContext, useEffect, useState } from 'react';

import { isElectron } from './utils';

type ElectronContextType = {
  processId: string | null;
  isElectron: boolean;
};

export const ElectronContext = createContext<ElectronContextType>({
  processId: null,
  isElectron: isElectron(),
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

  return (
    <ElectronContext.Provider value={{ processId, isElectron: isElectron() }}>
      {children}
    </ElectronContext.Provider>
  );
};
