import { createContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Filesystem } from '../ports/filesystem';
import { File } from '../types';
import {
  clearAll,
  clearAndInsertOne,
  get as getFromDB,
  openDB,
} from './database';

type SelectedFileContextType = {
  selectedFile: File | null;
  setSelectedFile: (file: File) => Promise<void>;
  clearFileSelection: () => Promise<void>;
};

export const SelectedFileContext = createContext<SelectedFileContextType>({
  selectedFile: null,
  setSelectedFile: async () => {},
  clearFileSelection: async () => {},
});

export const SelectedFileProvider = ({
  children,
  filesystem,
}: {
  filesystem: Filesystem;
  children: React.ReactNode;
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { documentId } = useParams();

  useEffect(() => {
    const getFile = async (filePath: string) => {
      const file = await filesystem.readFile(filePath);
      setSelectedFile(file);
    };

    if (!filePath) {
      filesystem.getSelectedFile();
    } else {
      getFile(filePath);
    }
  }, [filePath]);

  const persistSelectedFileInfo = async (fileInfo: FileInfo) => {
    const db = await openDB();
    await clearAndInsertOne({ fileInfo, db });
  };

  const clearFileSelection = async () => {
    await filesystem.setSelectedFile(null);
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
