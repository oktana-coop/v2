import * as Effect from 'effect/Effect';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { projectTypes } from '../../../../modules/domain/project';
import {
  type BinaryRichTextRepresentation,
  type GetDocumentAtCommitArgs,
  getDocumentRichTextContent,
  type IsContentSameAtHeadsArgs,
  isEmpty,
  processDocumentChange,
  type RichTextDocument,
  richTextRepresentations,
  type TextRichTextRepresentation,
  type VersionedDocument,
  type VersionedDocumentHandle,
  type VersionedDocumentStore,
} from '../../../../modules/domain/rich-text';
import { RepresentationTransformContext } from '../../../../modules/domain/rich-text/react/representation-transform-context';
import {
  type ArtifactHistoryInfo,
  type Change,
  type ChangeWithUrlInfo,
  type Commit,
  encodeURLHeads,
  encodeURLHeadsForChange,
  headsAreSame,
  type UrlHeads,
  VersionControlId,
} from '../../../../modules/infrastructure/version-control';
import { FunctionalityConfigContext } from '../../../../modules/personalization/browser';
import { useCurrentDocumentId } from '../../hooks/use-current-document-id';
import {
  CurrentProjectContext,
  InfrastructureAdaptersContext,
  MultiDocumentProjectContext,
} from '../';
import { createWorkerClient } from './history-worker/client';

const useWebWorker = true;

export type CurrentDocumentContextType = {
  versionedDocumentId: VersionControlId | null;
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
  onSelectCommit: (heads: UrlHeads) => void;
  getDocumentAtCommit: (
    args: GetDocumentAtCommitArgs
  ) => Promise<VersionedDocument>;
  isContentSameAtHeads: (args: IsContentSameAtHeadsArgs) => Promise<boolean>;
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
    onSelectCommit: () => {},
    // @ts-expect-error will get overriden below
    getDocumentAtCommit: async () => null,
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
  const { selectedFileInfo, setSelectedFileInfo, clearFileSelection } =
    useContext(MultiDocumentProjectContext);
  const { adapter: representationTransformAdapter } = useContext(
    RepresentationTransformContext
  );
  const loadHistoryFromWorker = useWebWorker ? createWorkerClient() : undefined;

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
        const documentHandle = await Effect.runPromise(
          versionedDocumentStore.findDocumentHandleById(documentId)
        );

        const document = await Effect.runPromise(
          versionedDocumentStore.getDocumentFromHandle(documentHandle)
        );

        setVersionedDocumentHandle(documentHandle);
        setVersionedDocument(document);
        setLoadingHistory(true);

        if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
          const pathParam = searchParams.get('path');
          const path = pathParam ? decodeURIComponent(pathParam) : null;

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
      documentId: VersionControlId,
      latestChangeHeads: UrlHeads,
      lastCommitHeads: UrlHeads
    ) => {
      if (!headsAreSame(latestChangeHeads, lastCommitHeads)) {
        const isContentSame = await Effect.runPromise(
          documentStore.isContentSameAtHeads({
            documentId,
            heads1: latestChangeHeads,
            heads2: lastCommitHeads,
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
      latestChangeHeads,
      lastCommitHeads,
    }: {
      docId: VersionControlId;
      doc: VersionedDocument;
      latestChangeHeads: UrlHeads;
      lastCommitHeads?: UrlHeads;
    }) => {
      if (lastCommitHeads) {
        return checkIfContentChangedFromLastCommit(documentStore)(
          docId,
          latestChangeHeads,
          lastCommitHeads
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
      docId: VersionControlId;
      doc: VersionedDocument;
    }) => {
      let historyInfo: ArtifactHistoryInfo<RichTextDocument>;

      if (useWebWorker && loadHistoryFromWorker) {
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
        urlEncodedHeads: encodeURLHeadsForChange(commit),
      }));

      setVersionedDocumentHistory(historyWithURLInfo);
      setLastCommit(lastCommit);
      setLoadingHistory(false);
      await checkIfCanCommit(documentStore)({
        docId,
        doc,
        latestChangeHeads: historyInfo.latestChange.heads,
        lastCommitHeads: lastCommit?.heads,
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
      setCanCommit(false);
    },
    [documentId, versionedDocumentStore]
  );

  const handleOpenCommitDialog = useCallback(() => {
    setIsCommitDialogOpen(true);
  }, []);

  const handleCloseCommitDialog = useCallback(() => {
    setIsCommitDialogOpen(false);
  }, []);

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

      let newUrl = `/projects/${projectId}/documents/${documentId}/changes/${encodeURLHeads(heads)}`;
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

  const handleGetDocumentAtCommit = useCallback(
    async (args: GetDocumentAtCommitArgs) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }

      return Effect.runPromise(
        versionedDocumentStore.getDocumentAtCommit(args)
      );
    },
    [versionedDocumentStore, projectId]
  );

  const handleIsContentSameAtHeads = useCallback(
    (args: IsContentSameAtHeadsArgs) => {
      if (
        !versionedDocumentStore ||
        versionedDocumentStore.projectId !== projectId
      ) {
        throw new Error(
          'Versioned document store not ready yet or mismatched project.'
        );
      }

      return Effect.runPromise(
        versionedDocumentStore.isContentSameAtHeads(args)
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

      await Effect.runPromise(
        processDocumentChange({
          transformToText: representationTransformAdapter.transformToText,
          updateRichTextDocumentContent:
            versionedDocumentStore.updateRichTextDocumentContent,
          writeFile: filesystem.writeFile,
        })({
          documentId,
          updatedDocument: doc,
          filePath: selectedFileInfo?.path ?? null,
          projectType,
        })
      );

      loadHistory(versionedDocumentStore)({
        docId: documentId,
        doc: versionedDocument,
      });

      const latestChangeHeads = await Effect.runPromise(
        versionedDocumentStore.getDocumentHeads(documentId)
      );

      await checkIfCanCommit(versionedDocumentStore)({
        docId: documentId,
        doc: versionedDocument,
        latestChangeHeads,
        lastCommitHeads: lastCommit?.heads,
      });
    },
    [
      versionedDocumentStore,
      projectId,
      documentId,
      representationTransformAdapter,
      filesystem,
      selectedFileInfo,
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
        from: richTextRepresentations.AUTOMERGE,
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
        from: richTextRepresentations.AUTOMERGE,
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
        onSelectCommit: handleSelectCommit,
        getDocumentAtCommit: handleGetDocumentAtCommit,
        isContentSameAtHeads: handleIsContentSameAtHeads,
        getExportText: exportToTextRepresentation,
        getExportBinaryData: exportToBinaryRepresentation,
      }}
    >
      {children}
    </CurrentDocumentContext.Provider>
  );
};
