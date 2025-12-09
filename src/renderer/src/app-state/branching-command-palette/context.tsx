import { createContext, useState } from 'react';

export type BranchingCommandPaletteContextType = {
  isOpen: boolean;
  openBranchingCommandPalette: () => void;
  closeBranchingCommandPalette: () => void;
};

export const BranchingCommandPaletteContext =
  createContext<BranchingCommandPaletteContextType>({
    isOpen: false,
    openBranchingCommandPalette: () => {},
    closeBranchingCommandPalette: () => {},
  });

export const BranchingCommandPaletteStateProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleOpenCommandPalette = () => {
    setIsOpen(true);
  };

  const handleCloseCommandPalette = () => {
    setIsOpen(false);
  };

  return (
    <BranchingCommandPaletteContext.Provider
      value={{
        isOpen,
        openBranchingCommandPalette: handleOpenCommandPalette,
        closeBranchingCommandPalette: handleCloseCommandPalette,
      }}
    >
      {children}
    </BranchingCommandPaletteContext.Provider>
  );
};
