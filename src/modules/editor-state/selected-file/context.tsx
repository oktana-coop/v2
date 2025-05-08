import { createContext, useContext, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { ElectronContext } from '../../electron';
import { FilesystemContext } from '../../filesystem';
import {
  type ChangeWithUrlInfo,
  convertToStorageFormat,
  type DocHandleChangePayload,
  encodeURLHeadsForChange,
  getDocumentHandleHistory,
  isContentSame,
  isValidVersionControlId,
  type RichTextDocument,
  type VersionControlId,
  VersionedDocument,
  type VersionedDocumentHandle,
} from '../../version-control';
import { VersionControlContext } from '../../version-control/react';

export type SelectedFileInfo = {
  documentId: VersionControlId;
  path: string | null;
};

type SelectedFileContextType = {
  selectedFileInfo: SelectedFileInfo | null;
  setSelectedFileInfo: (file: SelectedFileInfo) => Promise<void>;
  clearFileSelection: () => Promise<void>;
  versionedDocumentHandle: VersionedDocumentHandle | null;
  versionedDocumentHistory: ChangeWithUrlInfo[];
  canCommit: boolean;
};

export const SelectedFileContext = createContext<SelectedFileContextType>({
  selectedFileInfo: null,
  setSelectedFileInfo: async () => {},
  clearFileSelection: async () => {},
  versionedDocumentHandle: null,
  versionedDocumentHistory: [],
  canCommit: false,
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
  const [versionedDocumentHistory, setVersionedDocumentHistory] = useState<
    ChangeWithUrlInfo[]
  >([]);
  const [lastCommitDoc, setLastCommitDoc] = useState<VersionedDocument | null>(
    null
  );
  const [canCommit, setCanCommit] = useState(false);

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

  const checkIfContentChangedFromLastCommit = (
    currentDoc: VersionedDocument,
    previousDoc: VersionedDocument
  ) => {
    if (!isContentSame(currentDoc, previousDoc)) {
      setCanCommit(true);
    } else {
      setCanCommit(false);
    }
  };

  useEffect(() => {
    const loadHistory = async (docHandle: VersionedDocumentHandle) => {
      const { history, lastCommitDoc, currentDoc } =
        await getDocumentHandleHistory(docHandle);

      const historyWithURLInfo = history.map((commit) => ({
        ...commit,
        urlEncodedHeads: encodeURLHeadsForChange(commit),
      }));

      setVersionedDocumentHistory(historyWithURLInfo);
      setLastCommitDoc(lastCommitDoc);
      if (lastCommitDoc) {
        checkIfContentChangedFromLastCommit(currentDoc, lastCommitDoc);
      }
    };

    if (versionedDocumentHandle) {
      loadHistory(versionedDocumentHandle);
    }
  }, [versionedDocumentHandle]);

  useEffect(() => {
    if (versionedDocumentHandle && lastCommitDoc) {
      versionedDocumentHandle.on(
        'change',
        (args: DocHandleChangePayload<VersionedDocument>) =>
          checkIfContentChangedFromLastCommit(args.doc, lastCommitDoc)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCommitDoc]);

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

  return (
    <SelectedFileContext.Provider
      value={{
        selectedFileInfo,
        versionedDocumentHandle,
        setSelectedFileInfo: handleSetSelectedFileInfo,
        clearFileSelection,
        versionedDocumentHistory,
        canCommit,
      }}
    >
      {children}
    </SelectedFileContext.Provider>
  );
};
