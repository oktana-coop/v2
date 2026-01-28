import { createContext, useEffect, useState } from 'react';

import { useKeyBindings } from '../../hooks';
import { keyBindings } from '../../pages/project/shared/command-palette/key-bindings';

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
      window.electronAPI?.onToggleCommandPalette(() => {
        setIsOpen((state) => !state);
      });

    return () => {
      unsubscribeFromCommandPaletteOpenEvent?.();
    };
  }, []);

  useKeyBindings({
    [keyBindings.controlK.keyBinding]: () => setIsOpen((state) => !state),
  });

  const handleOpenCommandPalette = () => {
    setIsOpen(true);
  };

  const handleCloseCommandPalette = () => {
    setIsOpen(false);
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
