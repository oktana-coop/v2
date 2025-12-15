import { createContext, useState } from 'react';

export type CreateDocumentModalContextType = {
  isOpen: boolean;
  openCreateDocumentModal: () => void;
  closeCreateDocumentModal: () => void;
};

export const CreateDocumentModalContext =
  createContext<CreateDocumentModalContextType>({
    isOpen: false,
    openCreateDocumentModal: () => {},
    closeCreateDocumentModal: () => {},
  });

export const CreateDocumentModalProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleOpenCreateDocumentModal = () => {
    setIsOpen(true);
  };

  const handleCloseCreateDocumentModal = () => {
    setIsOpen(false);
  };

  return (
    <CreateDocumentModalContext.Provider
      value={{
        isOpen,
        openCreateDocumentModal: handleOpenCreateDocumentModal,
        closeCreateDocumentModal: handleCloseCreateDocumentModal,
      }}
    >
      {children}
    </CreateDocumentModalContext.Provider>
  );
};
