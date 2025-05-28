import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { ElectronContext } from '../../electron';
import { createAdapter } from '../adapters/automerge';
import {
  setupForElectron as setupBrowserRepoForElectron,
  setupForWeb as setupBrowserRepoForWeb,
} from '../automerge-repo/browser';
import {
  type ChangeWithUrlInfo,
  type Commit,
  type DocHandleChangePayload,
  encodeURLHeadsForChange,
  getDocumentHandleHistory,
  getDocumentHeads,
  headsAreSame,
  isContentSameAtHeads,
  isEmpty,
  type UrlHeads,
  type VersionControlId,
  type VersionedDocument,
  type VersionedDocumentHandle,
} from '../models';
import {
  type CreateDocumentArgs,
  type FindDocumentInProjectArgs,
  type GetDocumentHandleAtCommitArgs,
  type VersionControlRepo,
} from '../ports/version-control-repo';

type VersionControlContextType = {
  versionControlRepo: VersionControlRepo | null;
  isRepoReady: boolean;
  versionedDocumentHandle: VersionedDocumentHandle | null;
  setVersionedDocumentHandle: (handle: VersionedDocumentHandle | null) => void;
  versionedDocumentHistory: ChangeWithUrlInfo[];
  canCommit: boolean;
  onCommit: (message: string) => void;
  isCommitDialogOpen: boolean;
  onOpenCommitDialog: () => void;
  onCloseCommitDialog: () => void;
  createDocument: (args: CreateDocumentArgs) => Promise<VersionControlId>;
  getDocumentHandleAtCommit: (
    args: GetDocumentHandleAtCommitArgs
  ) => Promise<VersionedDocumentHandle>;
  findDocument: (
    id: VersionControlId
  ) => Promise<VersionedDocumentHandle | null>;
  findDocumentInProject: (
    args: FindDocumentInProjectArgs
  ) => Promise<VersionedDocumentHandle | null>;
};

export const VersionControlContext = createContext<VersionControlContextType>({
  versionControlRepo: null,
  isRepoReady: false,
  versionedDocumentHandle: null,
  setVersionedDocumentHandle: () => {},
  versionedDocumentHistory: [],
  canCommit: false,
  onCommit: () => {},
  isCommitDialogOpen: false,
  onOpenCommitDialog: () => {},
  onCloseCommitDialog: () => {},
  // @ts-expect-error will get overriden below
  createDocument: () => null,
  // @ts-expect-error will get overriden below
  getDocumentHandleAtCommit: () => null,
  // @ts-expect-error will get overriden below
  findDocument: () => null,
  // @ts-expect-error will get overriden below
  findDocumentInProject: () => null,
});

export const VersionControlProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [versionControlRepo, setVersionControlRepo] =
    useState<VersionControlRepo | null>(null);
  const [isRepoReady, setIsRepoReady] = useState<boolean>(false);
  const { processId, isElectron } = useContext(ElectronContext);
  const [versionedDocumentHandle, setVersionedDocumentHandle] =
    useState<VersionedDocumentHandle | null>(null);
  const [versionedDocumentHistory, setVersionedDocumentHistory] = useState<
    ChangeWithUrlInfo[]
  >([]);
  const [lastCommit, setLastCommit] = useState<Commit | null>(null);
  const [canCommit, setCanCommit] = useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    const setupVersionControlRepo = async () => {
      if (isElectron) {
        if (processId) {
          const automergeRepo = await setupBrowserRepoForElectron(processId);
          const vcRepo = createAdapter(automergeRepo);
          setVersionControlRepo(vcRepo);
          setIsRepoReady(true);
        } else {
          setIsRepoReady(false);
        }
      } else {
        const automergeRepo = await setupBrowserRepoForWeb();
        const vcRepo = createAdapter(automergeRepo);
        setVersionControlRepo(vcRepo);
        setIsRepoReady(true);
      }
    };

    setupVersionControlRepo();
  }, [processId, isElectron]);

  const checkIfCanCommit = (
    currentDoc: VersionedDocument,
    latestChangeHeads: UrlHeads,
    lastCommitHeads?: UrlHeads
  ) => {
    if (lastCommitHeads) {
      checkIfContentChangedFromLastCommit(
        currentDoc,
        latestChangeHeads,
        lastCommitHeads
      );
    } else {
      if (!isEmpty(currentDoc)) {
        setCanCommit(true);
      } else {
        setCanCommit(false);
      }
    }
  };

  const checkIfContentChangedFromLastCommit = (
    currentDoc: VersionedDocument,
    latestChangeHeads: UrlHeads,
    lastCommitHeads: UrlHeads
  ) => {
    if (
      !headsAreSame(latestChangeHeads, lastCommitHeads) &&
      !isContentSameAtHeads(currentDoc, latestChangeHeads, lastCommitHeads)
    ) {
      setCanCommit(true);
    } else {
      setCanCommit(false);
    }
  };

  const loadHistory = async (docHandle: VersionedDocumentHandle) => {
    const { history, currentDoc, lastCommit, latestChange } =
      await getDocumentHandleHistory(docHandle);

    const historyWithURLInfo = history.map((commit) => ({
      ...commit,
      urlEncodedHeads: encodeURLHeadsForChange(commit),
    }));

    setVersionedDocumentHistory(historyWithURLInfo);
    setLastCommit(lastCommit);
    checkIfCanCommit(currentDoc, latestChange.heads, lastCommit?.heads);
  };

  useEffect(() => {
    if (versionedDocumentHandle) {
      const handler = (args: DocHandleChangePayload<VersionedDocument>) => {
        loadHistory(versionedDocumentHandle);
        checkIfCanCommit(
          args.doc,
          getDocumentHeads(args.doc),
          lastCommit?.heads
        );
      };

      const debouncedHandler = debounce(handler, 300);
      versionedDocumentHandle.on('change', debouncedHandler);

      return () => {
        versionedDocumentHandle.off('change', debouncedHandler);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCommit, versionedDocumentHandle]);

  const commitChanges = useCallback(
    (message: string) => {
      if (!versionedDocumentHandle) return;

      versionedDocumentHandle.change(
        (doc) => {
          // this is effectively a no-op, but it triggers a change event
          // (not) changing the title of the document, as interfering with the
          // content outside the Prosemirror API will cause loss of formatting
          // eslint-disable-next-line no-self-assign
          doc.title = doc.title;
        },
        {
          message,
          time: new Date().getTime(),
        }
      );

      setIsCommitDialogOpen(false);
      setCanCommit(false);
    },
    [versionedDocumentHandle]
  );

  useEffect(() => {
    if (versionedDocumentHandle) {
      loadHistory(versionedDocumentHandle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionedDocumentHandle]);

  const handleOpenCommitDialog = useCallback(() => {
    setIsCommitDialogOpen(true);
  }, []);

  const handleCloseCommitDialog = useCallback(() => {
    setIsCommitDialogOpen(false);
  }, []);

  const handleSetVersionedDocumentHandle = (
    handle: VersionedDocumentHandle | null
  ) => {
    setVersionedDocumentHandle(handle);
  };

  const handleCreateDocument = async (args: CreateDocumentArgs) => {
    if (!versionControlRepo) {
      throw new Error('No repo found when trying to create document');
    }

    return Effect.runPromise(versionControlRepo.createDocument(args));
  };

  const handleGetDocumentHandleAtCommit = async (
    args: GetDocumentHandleAtCommitArgs
  ) => {
    if (!versionControlRepo) {
      throw new Error('No repo found when trying to get doc handle at commit');
    }

    return Effect.runPromise(
      versionControlRepo.getDocumentHandleAtCommit(args)
    );
  };

  const handleFindDocument = async (id: VersionControlId) => {
    if (!versionControlRepo) {
      throw new Error('No repo found when trying to create document');
    }

    return Effect.runPromise(versionControlRepo.findDocumentById(id));
  };

  const handleFindDocumentInProject = async ({
    projectId,
    documentPath,
  }: FindDocumentInProjectArgs) => {
    if (!versionControlRepo) {
      throw new Error('No repo found when trying to find file in project');
    }

    return Effect.runPromise(
      versionControlRepo.findDocumentInProject({ projectId, documentPath })
    );
  };

  return (
    <VersionControlContext.Provider
      value={{
        versionControlRepo,
        isRepoReady,
        versionedDocumentHandle,
        setVersionedDocumentHandle: handleSetVersionedDocumentHandle,
        versionedDocumentHistory,
        canCommit,
        onCommit: commitChanges,
        isCommitDialogOpen,
        onOpenCommitDialog: handleOpenCommitDialog,
        onCloseCommitDialog: handleCloseCommitDialog,
        createDocument: handleCreateDocument,
        getDocumentHandleAtCommit: handleGetDocumentHandleAtCommit,
        findDocument: handleFindDocument,
        findDocumentInProject: handleFindDocumentInProject,
      }}
    >
      {children}
    </VersionControlContext.Provider>
  );
};
