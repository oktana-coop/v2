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
    console.log('In electron context effect');
    window.electronAPI.onReceiveProcessId((processId: string) => {
      console.log(processId);
      setProcessId(processId);
    });
  }, []);

  return (
    <ElectronContext.Provider value={{ processId }}>
      {children}
    </ElectronContext.Provider>
  );
};
