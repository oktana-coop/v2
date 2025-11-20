import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import {
  isValidProjectId,
  projectTypes,
  urlEncodeProjectId,
} from '../../../../modules/domain/project';
import {
  type BinaryRichTextRepresentation,
  type GetDocumentAtChangeArgs,
  getDocumentRichTextContent,
  type IsContentSameAtChangesArgs,
  isEmpty,
  processDocumentChange,
  type RichTextDocument,
  type TextRichTextRepresentation,
  type VersionedDocument,
  type VersionedDocumentHandle,
  type VersionedDocumentStore,
} from '../../../../modules/domain/rich-text';
import { RepresentationTransformContext } from '../../../../modules/domain/rich-text/react/representation-transform-context';
import {
  type ArtifactHistoryInfo,
  type Change,
  type ChangeId,
  changeIdsAreSame,
  type ChangeWithUrlInfo,
  type Commit,
  decomposeGitBlobRef,
  isGitBlobRef,
  type ResolvedArtifactId,
  urlEncodeArtifactId,
  urlEncodeChangeId,
  urlEncodeChangeIdForChange,
} from '../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../modules/personalization/browser';
import { useCurrentDocumentId } from '../../hooks/use-current-document-id';
import {
  CurrentProjectContext,
  InfrastructureAdaptersContext,
  MultiDocumentProjectContext,
  SingleDocumentProjectContext,
} from '../';
import { createWorkerClient } from './history-worker/client';

const useHistoryWorker = window.config.useHistoryWorker;

export type CurrentDocumentContextType = {
  versionedDocumentId: ResolvedArtifactId | null;
  versionedDocumentHandle: VersionedDocumentHandle | null;
  versionedDocument: VersionedDocument | null;
  onDocumentContentChange: (doc: RichTextDocument) => Promise<void>;
  loadingHistory: boolean;
  versionedDocumentHistory: ChangeWithUrlInfo[];
  canCommit: boolean;
  onCommit: (message: string) => Promise<void>;
  isCommitDialogOpen: boolean;
  onOpenCommitDialog: () => void;
  onCloseCommitDialog: () => void;
  selectedCommitIndex: number | null;
  onSelectChange: (commitId: ChangeId) => void;
  getDocumentAtChange: (
    args: GetDocumentAtChangeArgs
  ) => Promise<VersionedDocument>;
  isContentSameAtChanges: (
    args: IsContentSameAtChangesArgs
  ) => Promise<boolean>;
  getExportText: (
    representation: TextRichTextRepresentation
  ) => Promise<string>;
  getExportBinaryData: (
    representation: BinaryRichTextRepresentation
  ) => Promise<Uint8Array>;
};

export const CurrentDocumentContext = createContext<CurrentDocumentContextType>(
  {
    versionedDocumentId: null,
    versionedDocumentHandle: null,
    versionedDocument: null,
    onDocumentContentChange: async () => {},
    loadingHistory: false,
    versionedDocumentHistory: [],
    canCommit: false,
    onCommit: async () => {},
    isCommitDialogOpen: false,
    onOpenCommitDialog: () => {},
    onCloseCommitDialog: () => {},
    selectedCommitIndex: null,
    onSelectChange: () => {},
    // @ts-expect-error will get overriden below
    getDocumentAtChange: async () => null,
    getExportText: async () => '',
    // @ts-expect-error will get overriden below
    getExportBinaryData: async () => null,
  }
);

export const CurrentDocumentProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { filesystem, versionedDocumentStore } = useContext(
    InfrastructureAdaptersContext
  );
  const { projectType } = useContext(CurrentProjectContext);
  const [versionedDocumentHandle, setVersionedDocumentHandle] =
    useState<VersionedDocumentHandle | null>(null);
  const [versionedDocument, setVersionedDocument] =
    useState<VersionedDocument | null>(null);
  const { projectId } = useParams();
  const documentId = useCurrentDocumentId();
  const [searchParams] = useSearchParams();
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [versionedDocumentHistory, setVersionedDocumentHistory] = useState<
    ChangeWithUrlInfo[]
  >([]);
  const [lastCommit, setLastCommit] = useState<Commit | null>(null);
  const [canCommit, setCanCommit] = useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState<boolean>(false);
  const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(
    null
  );
  const { showDiffInHistoryView } = useContext(FunctionalityConfigContext);
  const navigate = useNavigate();
  const {
    selectedFileInfo,
    setSelectedFileInfo,
    clearFileSelection,
    directory,
  } = useContext(MultiDocumentProjectContext);
  const { documentInternalPath } = useContext(SingleDocumentProjectContext);
  const { adapter: representationTransformAdapter } = useContext(
    RepresentationTransformContext
  );
  const loadHistoryFromWorker = useHistoryWorker
    ? createWorkerClient()
    : undefined;

  useEffect(() => {
    const updateDocumentHandleAndSelectedFile = async ({
      versionedDocumentStore,
    }: {
      versionedDocumentStore: VersionedDocumentStore;
    }) => {
      if (!documentId) {
        clearFileSelection();
        setVersionedDocumentHandle(null);
        setVersionedDocument(null);
      } else {
        setVersionedDocumentHandle(null);
        setVersionedDocument(null);

        const { artifact: document, handle: documentHandle } =
          await Effect.runPromise(
            versionedDocumentStore.findDocumentById(documentId)
          );

        setVersionedDocumentHandle(documentHandle);
        setVersionedDocument(document);
        setLoadingHistory(true);

        // TODO: Clean this up. The ID in the Automerge case is not the file path, so we need to get it from somewhere else.
        // This is why we use the path query param, which must be set.
        // But this introduces potential race conditions (e.g. documentId and searchParams getting out-of-sync)
        if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
          let path: string | null;

          if (isGitBlobRef(documentId)) {
            const decomposedBlobRef = decomposeGitBlobRef(documentId);
            path = decomposedBlobRef.path;
          } else {
            const pathParam = searchParams.get('path');
            path = pathParam ? decodeURIComponent(pathParam) : null;
          }

          if (!path) {
            throw new Error(
              'Cannot propagate changes to file since path is not provided'
            );
          }

          setSelectedFileInfo({
            documentId,
            path,
          });
        }
      }
    };

    if (
      versionedDocumentStore &&
      // This is a very important safeguard. We don't want to ask the document from a document store that belongs to another project
      // due to how Automerge repo syncing works at the moment. If this happens, the repo registers interest in the wrong document
      // and can potentially get it if we are not careful when switching projects. Change with caution.
      versionedDocumentStore.projectId === projectId
    ) {
      updateDocumentHandleAndSelectedFile({ versionedDocumentStore });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, projectId, versionedDocumentStore]);

  const checkIfContentChangedFromLastCommit =
    (documentStore: VersionedDocumentStore) =>
    async (
      documentId: ResolvedArtifactId,
      latestChangeId: ChangeId,
      lastCommitId: ChangeId
    ) => {
      if (!changeIdsAreSame(latestChangeId, lastCommitId)) {
        const isContentSame = await Effect.runPromise(
          documentStore.isContentSameAtChanges({
            documentId,
            change1: latestChangeId,
            change2: lastCommitId,
          })
        );

        if (!isContentSame) {
          setCanCommit(true);
        } else {
          setCanCommit(false);
        }
      } else {
        setCanCommit(false);
      }
    };

  const checkIfCanCommit =
    (documentStore: VersionedDocumentStore) =>
    async ({
      docId,
      doc,
      latestChangeId,
      lastCommitId,
    }: {
      docId: ResolvedArtifactId;
      doc: VersionedDocument;
      latestChangeId: ChangeId;
      lastCommitId?: ChangeId;
    }) => {
      if (lastCommitId) {
        return checkIfContentChangedFromLastCommit(documentStore)(
          docId,
          latestChangeId,
          lastCommitId
        );
      } else {
        if (!isEmpty(doc)) {
          setCanCommit(true);
        } else {
          setCanCommit(false);
        }
      }
    };

  const loadHistory =
    (documentStore: VersionedDocumentStore) =>
    async ({
      docId,
      doc,
    }: {
      docId: ResolvedArtifactId;
      doc: VersionedDocument;
    }) => {
      let historyInfo: ArtifactHistoryInfo<RichTextDocument>;

      if (
        useHistoryWorker &&
        loadHistoryFromWorker &&
        documentStore.exportDocumentToBinary
      ) {
        const documentData = await Effect.runPromise(
          documentStore.exportDocumentToBinary(doc)
        );

        historyInfo = await loadHistoryFromWorker(documentData);
      } else {
        historyInfo = await Effect.runPromise(
          documentStore.getDocumentHistory(docId)
        );
      }

      const historyWithURLInfo = historyInfo.history.map((commit) => ({
        ...commit,
        urlEncodedChangeId: urlEncodeChangeIdForChange(commit),
      }));

      setVersionedDocumentHistory(historyWithURLInfo);
      setLastCommit(historyInfo.lastCommit);
      setLoadingHistory(false);
      await checkIfCanCommit(documentStore)({
        docId,
        doc: historyInfo.current,
        latestChangeId: historyInfo.latestChange.id,
        lastCommitId: historyInfo.lastCommit?.id,
      });
    };

  useEffect(() => {
    if (versionedDocumentStore && documentId && versionedDocument) {
      loadHistory(versionedDocumentStore)({
        doc: versionedDocument,
        docId: documentId,
      });
    }
  }, [versionedDocument]);

  const handleCommit = useCallback(
    async (message: string) => {
      if (!documentId || !versionedDocumentStore) return;
      await Effect.runPromise(
        versionedDocumentStore.commitChanges({
          documentId,
          message,
        })
      );

      setIsCommitDialogOpen(false);

      if (versionedDocument) {
        await loadHistory(versionedDocumentStore)({
          doc: versionedDocument,
          docId: documentId,
        });
      }
    },
    [documentId, versionedDocument, versionedDocumentStore]
  );

  const handleOpenCommitDialog = useCallback(() => {
    setIsCommitDialogOpen(true);
  }, []);

  const handleCloseCommitDialog = useCallback(() => {
    setIsCommitDialogOpen(false);
  }, []);

  const handleSelectChange = useCallback(
    (changeId: ChangeId) => {
      if (!projectId || !isValidProjectId(projectId) || !documentId) {
        throw new Error(
          'Cannot select a change since projectId or documentId are not set yet.'
        );
      }

      const isInitialChange = (index: number, changes: Change[]) =>
        index === changes.length - 1;

      const selectedCommitIndex = versionedDocumentHistory.findIndex((commit) =>
        changeIdsAreSame(commit.id, changeId)
      );

      const isFirstCommit = isInitialChange(
        selectedCommitIndex,
        versionedDocumentHistory
      );

      const diffCommit = isFirstCommit
        ? null
        : versionedDocumentHistory[selectedCommitIndex + 1];

      let newUrl = `/projects/${urlEncodeProjectId(projectId)}/documents/${urlEncodeArtifactId(documentId)}/changes/${urlEncodeChangeId(changeId)}`;
      if (diffCommit) {
        const diffChangeURLEncodedId = urlEncodeChangeIdForChange(diffCommit);
        newUrl += `?diffWith=${diffChangeURLEncodedId}`;
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

  const handleGetDocumentAtChange = useCallback(
    async (args: GetDocumentAtChangeArgs) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }

      return Effect.runPromise(
        versionedDocumentStore.getDocumentAtChange(args)
      );
    },
    [versionedDocumentStore, projectId]
  );

  const handleIsContentSameAtChanges = useCallback(
    (args: IsContentSameAtChangesArgs) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }

      return Effect.runPromise(
        versionedDocumentStore.isContentSameAtChanges(args)
      );
    },
    [versionedDocumentStore, projectId]
  );

  const handleDocumentContentChange = useCallback(
    async (doc: RichTextDocument) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }

      if (!documentId) {
        throw new Error('Versioned document id not set yet.');
      }

      if (!versionedDocument) {
        throw new Error('Versioned document not set yet.');
      }

      if (!representationTransformAdapter) {
        throw new Error(
          'No representation transform adapter found when trying to convert to Automerge'
        );
      }

      if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
        if (!directory || !selectedFileInfo?.path) {
          throw new Error('Cannot update file in multi-doc project');
        }

        await Effect.runPromise(
          pipe(
            filesystem.getAbsolutePath({
              path: selectedFileInfo.path,
              dirPath: directory.path,
            }),
            Effect.flatMap((absoluteFilePath) =>
              processDocumentChange({
                transformToText: representationTransformAdapter.transformToText,
                updateRichTextDocumentContent:
                  versionedDocumentStore.updateRichTextDocumentContent,
                writeFile: filesystem.writeFile,
              })({
                documentId,
                updatedDocument: doc,
                writeToFileWithPath:
                  versionedDocumentStore.managesFilesystemWorkdir
                    ? absoluteFilePath
                    : null,
                projectType,
              })
            )
          )
        );
      } else {
        await Effect.runPromise(
          processDocumentChange({
            transformToText: representationTransformAdapter.transformToText,
            updateRichTextDocumentContent:
              versionedDocumentStore.updateRichTextDocumentContent,
            writeFile: filesystem.writeFile,
          })({
            documentId,
            updatedDocument: doc,
            writeToFileWithPath: versionedDocumentStore.managesFilesystemWorkdir
              ? documentInternalPath
              : null,
            projectType,
          })
        );
      }

      await loadHistory(versionedDocumentStore)({
        docId: documentId,
        doc: versionedDocument,
      });
    },
    [
      versionedDocumentStore,
      projectId,
      documentId,
      documentInternalPath,
      representationTransformAdapter,
      filesystem,
      selectedFileInfo,
      directory,
      projectType,
      versionedDocument,
      lastCommit,
    ]
  );

  const exportToTextRepresentation = useCallback(
    async (representation: TextRichTextRepresentation) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }

      if (!representationTransformAdapter) {
        throw new Error(
          'No representation transform adapter found when trying to convert to Markdown'
        );
      }

      if (!versionedDocument) {
        throw new Error(
          'Document ID not set when trying to export to Markdown'
        );
      }

      const documentContent = getDocumentRichTextContent(versionedDocument);

      const str = await representationTransformAdapter.transformToText({
        from: versionedDocument.representation,
        to: representation,
        input: documentContent,
      });

      return str;
    },
    [
      versionedDocumentStore,
      projectId,
      representationTransformAdapter,
      versionedDocument,
    ]
  );

  const exportToBinaryRepresentation = useCallback(
    async (representation: BinaryRichTextRepresentation) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }

      if (!representationTransformAdapter) {
        throw new Error(
          'No representation transform adapter found when trying to convert to Markdown'
        );
      }

      if (!versionedDocument) {
        throw new Error(
          'Document ID not set when trying to export to Markdown'
        );
      }

      const documentContent = getDocumentRichTextContent(versionedDocument);

      const str = await representationTransformAdapter.transformToBinary({
        from: versionedDocument.representation,
        to: representation,
        input: documentContent,
      });

      return str;
    },
    [
      versionedDocumentStore,
      projectId,
      representationTransformAdapter,
      versionedDocument,
    ]
  );

  return (
    <CurrentDocumentContext.Provider
      value={{
        versionedDocumentId: documentId,
        versionedDocumentHandle,
        versionedDocument,
        onDocumentContentChange: handleDocumentContentChange,
        loadingHistory,
        versionedDocumentHistory,
        canCommit,
        onCommit: handleCommit,
        isCommitDialogOpen,
        onOpenCommitDialog: handleOpenCommitDialog,
        onCloseCommitDialog: handleCloseCommitDialog,
        selectedCommitIndex,
        onSelectChange: handleSelectChange,
        getDocumentAtChange: handleGetDocumentAtChange,
        isContentSameAtChanges: handleIsContentSameAtChanges,
        getExportText: exportToTextRepresentation,
        getExportBinaryData: exportToBinaryRepresentation,
      }}
    >
      {children}
    </CurrentDocumentContext.Provider>
  );
};
