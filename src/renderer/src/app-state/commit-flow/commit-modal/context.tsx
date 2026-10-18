import { createContext, useState } from 'react';

export type CommitModalContextType = {
  isOpen: boolean;
  openCommitModal: () => void;
  closeCommitModal: () => void;
};

export const CommitModalContext = createContext<CommitModalContextType>({
  isOpen: false,
  openCommitModal: () => {},
  closeCommitModal: () => {},
});

export const CommitModalProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const openCommitModal = () => {
    setIsOpen(true);
  };

  const closeCommitModal = () => {
    setIsOpen(false);
  };

  return (
    <CommitModalContext.Provider
      value={{
        isOpen,
        openCommitModal,
        closeCommitModal,
      }}
    >
      {children}
    </CommitModalContext.Provider>
  );
};
