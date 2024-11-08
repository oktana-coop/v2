import { createContext, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { type AutomergeUrl, isValidAutomergeUrl } from '../../version-control';

export type VersionedFileInfo = {
  documentId: AutomergeUrl;
  path: string | null;
};

type SelectedFileContextType = {
  selectedFileInfo: VersionedFileInfo | null;
  setSelectedFileInfo: (file: VersionedFileInfo) => Promise<void>;
  clearFileSelection: () => Promise<void>;
};

export const SelectedFileContext = createContext<SelectedFileContextType>({
  selectedFileInfo: null,
  setSelectedFileInfo: async () => {},
  clearFileSelection: async () => {},
});

export const SelectedFileProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<VersionedFileInfo | null>(null);
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!isValidAutomergeUrl(documentId)) {
      clearFileSelection();
    } else {
      const path = searchParams.get('path');

      setSelectedFileInfo({
        documentId,
        path: path ? decodeURIComponent(path) : null,
      });
    }
  }, [documentId]);

  const clearFileSelection = async () => {
    setSelectedFileInfo(null);
  };

  const handleSetSelectedFileInfo = async ({
    documentId,
    path,
  }: VersionedFileInfo) => {
    setSelectedFileInfo({
      documentId,
      path: path,
    });
  };

  return (
    <SelectedFileContext.Provider
      value={{
        selectedFileInfo,
        setSelectedFileInfo: handleSetSelectedFileInfo,
        clearFileSelection,
      }}
    >
      {children}
    </SelectedFileContext.Provider>
  );
};
