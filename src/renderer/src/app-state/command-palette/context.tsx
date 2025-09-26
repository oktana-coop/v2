import { createContext, useEffect, useState } from 'react';

import { useKeyBindings } from '../../hooks';

export type CommandPaletteContextType = {
  isOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
};

export const CommandPaletteContext = createContext<CommandPaletteContextType>({
  isOpen: false,
  openCommandPalette: () => {},
  closeCommandPalette: () => {},
});

export const CommandPaletteStateProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribeFromCommandPaletteOpenEvent =
      window.electronAPI?.onOpenCommandPalette(() => {
        setIsOpen((state) => !state);
      });

    return () => {
      unsubscribeFromCommandPaletteOpenEvent?.();
    };
  }, []);

  useKeyBindings({
    'ctrl+k': () => setIsOpen((state) => !state),
  });

  const handleOpenCommandPalette = () => {
    setIsOpen(true);
  };

  const handleCloseCommandPalette = () => {
    setIsOpen(true);
  };

  return (
    <CommandPaletteContext.Provider
      value={{
        isOpen,
        openCommandPalette: handleOpenCommandPalette,
        closeCommandPalette: handleCloseCommandPalette,
      }}
    >
      {children}
    </CommandPaletteContext.Provider>
  );
};
