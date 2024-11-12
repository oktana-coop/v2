import { createContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { isValidVersionControlId } from '../../version-control';
import {
  clearAll,
  clearAndInsertOne,
  get as getFromDB,
  openDB,
} from './database';
import { FileInfo } from './types';

type SelectedFileContextType = {
  selectedFileInfo: FileInfo | null;
  setSelectedFileInfo: (file: FileInfo) => Promise<void>;
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
  const [selectedFileInfo, setSelectedFileInfo] = useState<FileInfo | null>(
    null
  );
  const { documentId: automergeUrl } = useParams();

  useEffect(() => {
    const getFile = async (automergeUrl: FileInfo['automergeUrl']) => {
      // This is the IndexedDB object store for the selected file info
      const db = await openDB();
      const fileInfo = await getFromDB({ automergeUrl, db });
      setSelectedFileInfo(fileInfo);
    };

    if (!isValidVersionControlId(automergeUrl)) {
      clearFileSelection();
    } else {
      getFile(automergeUrl);
    }
  }, [automergeUrl]);

  const persistSelectedFileInfo = async (fileInfo: FileInfo) => {
    const db = await openDB();
    await clearAndInsertOne({ fileInfo, db });
  };

  const clearFileSelection = async () => {
    const db = await openDB();
    await clearAll(db);
  };

  return (
    <SelectedFileContext.Provider
      value={{
        selectedFileInfo,
        setSelectedFileInfo: persistSelectedFileInfo,
        clearFileSelection,
      }}
    >
      {children}
    </SelectedFileContext.Provider>
  );
};
