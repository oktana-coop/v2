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
import { VersionControlContext } from '../../version-control/react';

const SHOW_DIFF_IN_HISTORY_VIEW_KEY = 'showDiffInHistoryView';

export type SelectedFileInfo = {
  documentId: VersionControlId;
  path: string | null;
};

type SelectedFileContextType = {
  selectedFileInfo: SelectedFileInfo | null;
  setSelectedFileInfo: (file: SelectedFileInfo) => Promise<void>;
  clearFileSelection: () => Promise<void>;
  versionedDocumentHandle: VersionedDocumentHandle | null;
  showDiffInHistoryView: boolean;
  setShowDiffInHistoryView: (value: boolean) => void;
};

export const SelectedFileContext = createContext<SelectedFileContextType>({
  selectedFileInfo: null,
  setSelectedFileInfo: async () => {},
  clearFileSelection: async () => {},
  versionedDocumentHandle: null,
  showDiffInHistoryView: true,
  setShowDiffInHistoryView: () => {},
});

export const SelectedFileProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isElectron } = useContext(ElectronContext);
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<SelectedFileInfo | null>(null);
  const [versionedDocumentHandle, setVersionedDocumentHandle] =
    useState<VersionedDocumentHandle | null>(null);
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();
  const { findDocument } = useContext(VersionControlContext);
  const { writeFile } = useContext(FilesystemContext);

  const [showDiffInHistoryView, setShowDiffInHistoryView] = useState(
    localStorage.getItem(SHOW_DIFF_IN_HISTORY_VIEW_KEY) === 'true'
  );

  useEffect(() => {
    const updateFileSelection = async () => {
      if (!isValidVersionControlId(documentId)) {
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
  }: SelectedFileInfo) => {
    if (isElectron) {
      window.electronAPI.sendCurrentDocumentId(documentId);
    }

    setSelectedFileInfo({
      documentId,
      path: path,
    });
  };

  const handleToggleShowDiffInHistoryView = (value: boolean) => {
    localStorage.setItem(SHOW_DIFF_IN_HISTORY_VIEW_KEY, value.toString());
    setShowDiffInHistoryView(value);
  };

  return (
    <SelectedFileContext.Provider
      value={{
        selectedFileInfo,
        versionedDocumentHandle,
        setSelectedFileInfo: handleSetSelectedFileInfo,
        clearFileSelection,
        showDiffInHistoryView,
        setShowDiffInHistoryView: handleToggleShowDiffInHistoryView,
      }}
    >
      {children}
    </SelectedFileContext.Provider>
  );
};
