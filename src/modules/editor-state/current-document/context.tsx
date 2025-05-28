import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { ElectronContext } from '../../electron';
import { removeExtension, removePath } from '../../filesystem';
import { FilesystemContext } from '../../filesystem/react';
import { FunctionalityConfigContext } from '../../personalization/functionality-config';
import {
  type Change,
  convertToStorageFormat,
  type DocHandleChangePayload,
  encodeURLHeads,
  encodeURLHeadsForChange,
  headsAreSame,
  isValidVersionControlId,
  type RichTextDocument,
  type UrlHeads,
  type VersionControlId,
  type VersionedDocumentHandle,
} from '../../version-control';
import { VersionControlContext } from '../../version-control/react';

export type SelectedFileInfo = {
  documentId: VersionControlId;
  path: string | null;
};

type CurrentDocumentContextType = {
  selectedFileInfo: SelectedFileInfo | null;
  selectedFileName: string | null;
  setSelectedFileInfo: (file: SelectedFileInfo) => Promise<void>;
  clearFileSelection: () => Promise<void>;
  selectedCommitIndex: number | null;
  onSelectCommit: (heads: UrlHeads) => void;
};

export const CurrentDocumentContext = createContext<CurrentDocumentContextType>(
  {
    selectedFileInfo: null,
    selectedFileName: null,
    setSelectedFileInfo: async () => {},
    clearFileSelection: async () => {},
    selectedCommitIndex: null,
    onSelectCommit: () => {},
  }
);

export const CurrentDocumentProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isElectron } = useContext(ElectronContext);
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<SelectedFileInfo | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();
  const {
    findDocument,
    versionedDocumentHandle,
    setVersionedDocumentHandle,
    versionedDocumentHistory,
  } = useContext(VersionControlContext);
  const { writeFile } = useContext(FilesystemContext);

  const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(
    null
  );
  const { showDiffInHistoryView } = useContext(FunctionalityConfigContext);
  const navigate = useNavigate();

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

  useEffect(() => {
    if (selectedFileInfo && selectedFileInfo.path) {
      const fullFileName = removePath(selectedFileInfo.path);
      const cleanFileName = removeExtension(fullFileName);
      setSelectedFileName(cleanFileName);
    }
  }, [selectedFileInfo]);

  useEffect(() => {
    const updateDocTitle = async (docHandle: VersionedDocumentHandle) => {
      const doc = await docHandle.doc();
      document.title = `v2 | "${doc.title}"`;
    };

    if (versionedDocumentHandle) {
      updateDocTitle(versionedDocumentHandle);
    }
  }, [versionedDocumentHandle]);

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

  const handleSelectCommit = useCallback(
    (heads: UrlHeads) => {
      const isInitialChange = (index: number, changes: Change[]) =>
        index === changes.length - 1;

      const selectedCommitIndex = versionedDocumentHistory.findIndex((commit) =>
        headsAreSame(commit.heads, heads)
      );

      const isFirstCommit = isInitialChange(
        selectedCommitIndex,
        versionedDocumentHistory
      );

      const diffCommit = isFirstCommit
        ? null
        : versionedDocumentHistory[selectedCommitIndex + 1];

      let newUrl = `/documents/${documentId}/changes/${encodeURLHeads(heads)}`;
      if (diffCommit) {
        const diffCommitURLEncodedHeads = encodeURLHeadsForChange(diffCommit);
        newUrl += `?diffWith=${diffCommitURLEncodedHeads}`;
      }

      if (showDiffInHistoryView && diffCommit) {
        newUrl += `&showDiff=true`;
      }

      setSelectedCommitIndex(selectedCommitIndex);
      navigate(newUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId, versionedDocumentHistory, showDiffInHistoryView]
  );

  return (
    <CurrentDocumentContext.Provider
      value={{
        selectedFileInfo,
        selectedFileName,
        setSelectedFileInfo: handleSetSelectedFileInfo,
        clearFileSelection,
        selectedCommitIndex,
        onSelectCommit: handleSelectCommit,
      }}
    >
      {children}
    </CurrentDocumentContext.Provider>
  );
};
