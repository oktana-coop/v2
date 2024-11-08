import { createContext, useEffect, useState } from 'react';

type ElectronContextType = {
  processId: string | null;
};

export const ElectronContext = createContext<ElectronContextType>({
  processId: null,
});

export const ElectronProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [processId, setProcessId] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.onReceiveProcessId((processId: string) => {
      setProcessId(processId);
    });
  }, []);

  return (
    <ElectronContext.Provider value={{ processId }}>
      {children}
    </ElectronContext.Provider>
  );
};
