import { createContext, useState } from 'react';

export type CloneFromGithubModalContextType = {
  isOpen: boolean;
  openCloneFromGithubModal: () => void;
  closeCloneFromGithubModal: () => void;
};

export const CloneFromGithubModalContext =
  createContext<CloneFromGithubModalContextType>({
    isOpen: false,
    openCloneFromGithubModal: () => {},
    closeCloneFromGithubModal: () => {},
  });

export const CloneFromGithubModalProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleOpenCloneFromGithubModal = () => {
    setIsOpen(true);
  };

  const handleCloseCloneFromGithubModal = () => {
    setIsOpen(false);
  };

  return (
    <CloneFromGithubModalContext.Provider
      value={{
        isOpen,
        openCloneFromGithubModal: handleOpenCloneFromGithubModal,
        closeCloneFromGithubModal: handleCloseCloneFromGithubModal,
      }}
    >
      {children}
    </CloneFromGithubModalContext.Provider>
  );
};
