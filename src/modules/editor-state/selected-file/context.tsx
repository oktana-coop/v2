import { createContext, useContext, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { ElectronContext } from '../../electron';
import { FilesystemContext } from '../../filesystem';
import {
  convertToStorageFormat,
  type DocHandleChangePayload,
  isValidVersionControlId,
  type RichTextDocument,
  type VersionControlId,
  type VersionedDocumentHandle,
} from '../../version-control';
import { VersionControlContext } from '../../version-control/repo/browser';

export type VersionedFileInfo = {
  documentId: VersionControlId;
  path: string | null;
};

type SelectedFileContextType = {
  selectedFileInfo: VersionedFileInfo | null;
  setSelectedFileInfo: (file: VersionedFileInfo) => Promise<void>;
  clearFileSelection: () => Promise<void>;
  versionedDocumentHandle: VersionedDocumentHandle | null;
};

export const SelectedFileContext = createContext<SelectedFileContextType>({
  selectedFileInfo: null,
  setSelectedFileInfo: async () => {},
  clearFileSelection: async () => {},
  versionedDocumentHandle: null,
});

export const SelectedFileProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isElectron } = useContext(ElectronContext);
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<VersionedFileInfo | null>(null);
  const [versionedDocumentHandle, setVersionedDocumentHandle] =
    useState<VersionedDocumentHandle | null>(null);
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();
  const { findDocument } = useContext(VersionControlContext);
  const { writeFile } = useContext(FilesystemContext);

  useEffect(() => {
    const updateFileSelection = async () => {
      if (!isValidVersionControlId(documentId)) {
        console.log('setting selected file to null', documentId);
        clearFileSelection();
        setVersionedDocumentHandle(null);
      } else {
        const pathParam = searchParams.get('path');
        const path = pathParam ? decodeURIComponent(pathParam) : null;

        const documentHandle = await findDocument(documentId);
        if (!documentHandle) {
          throw new Error(
            'No document handle found in repository for the selected document'
          );
        }

        const propagateChangesToFile = (
          changePayload: DocHandleChangePayload<RichTextDocument>
        ) => {
          if (path) {
            writeFile(path, convertToStorageFormat(changePayload.doc));
          }
        };

        documentHandle.on('change', propagateChangesToFile);

        setVersionedDocumentHandle(documentHandle);
        setSelectedFileInfo({
          documentId,
          path,
        });

        return () => {
          documentHandle.off('change', propagateChangesToFile);
        };
      }
    };

    updateFileSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const clearFileSelection = async () => {
    setSelectedFileInfo(null);
  };

  const handleSetSelectedFileInfo = async ({
    documentId,
    path,
  }: VersionedFileInfo) => {
    if (isElectron) {
      window.electronAPI.sendCurrentDocumentId(documentId);
    }

    setSelectedFileInfo({
      documentId,
      path: path,
    });
  };

  return (
    <SelectedFileContext.Provider
      value={{
        selectedFileInfo,
        versionedDocumentHandle,
        setSelectedFileInfo: handleSetSelectedFileInfo,
        clearFileSelection,
      }}
    >
      {children}
    </SelectedFileContext.Provider>
  );
};
