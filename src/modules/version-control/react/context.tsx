import * as Effect from 'effect/Effect';
import { createContext, useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../electron';
import { createAdapter } from '../adapters/automerge';
import {
  setupForElectron as setupBrowserRepoForElectron,
  setupForWeb as setupBrowserRepoForWeb,
} from '../automerge-repo/browser';
import { VersionControlId, VersionedDocumentHandle } from '../models';
import {
  type CreateDocumentArgs,
  type FindDocumentInProjectArgs,
  type GetDocumentHandleAtCommitArgs,
  type VersionControlRepo,
} from '../ports/version-control-repo';

type VersionControlContextType = {
  versionControlRepo: VersionControlRepo | null;
  isRepoReady: boolean;
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
