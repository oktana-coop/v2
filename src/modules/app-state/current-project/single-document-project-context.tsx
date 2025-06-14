import * as Effect from 'effect/Effect';
import { createContext, useContext, useEffect, useState } from 'react';

import { type SingleDocumentProjectStore } from '../../domain/project';
import { VersionControlId } from '../../infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';

type BrowserStorageProjectData = {
  projectId: VersionControlId;
  filePath: string;
};

const BROWSER_STORAGE_PROJECT_DATA_KEY = 'single-document-project';

export type SingleDocumentProjectContextType = {
  projectId: VersionControlId | null;
  versionedProjectStore: SingleDocumentProjectStore | null;
  createNewDocument: (
    suggestedName: string
  ) => Promise<{ documentId: VersionControlId; path: string }>;
  openDocument: () => Promise<{ documentId: VersionControlId; path: string }>;
};

export const SingleDocumentProjectContext =
  createContext<SingleDocumentProjectContextType>({
    projectId: null,
    // @ts-expect-error will get overriden below
    createNewDocument: () => null,
    // @ts-expect-error will get overriden below
    openDocument: () => null,
    versionedProjectStore: null,
  });

export const SingleDocumentProjectProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { filesystem, projectStoreManager, setVersionedDocumentStore } =
    useContext(InfrastructureAdaptersContext);
  const [projectId, setProjectId] = useState<VersionControlId | null>(null);
  const [versionedProjectStore, setVersionedProjectStore] =
    useState<SingleDocumentProjectStore | null>(null);

  const handleCreateNewDocument = async (suggestedName: string) => {
    const {
      versionedDocumentStore: documentStore,
      versionedProjectStore: projectStore,
      projectId: projId,
      documentId,
      filePath,
    } = await Effect.runPromise(
      projectStoreManager.setupSingleDocumentProjectStore({
        createNewFile: filesystem.createNewFile,
      })({ suggestedName })
    );

    setProjectId(projId);
    setVersionedProjectStore(projectStore);
    setVersionedDocumentStore(documentStore);

    return { documentId, path: filePath! };
  };

  const handleOpenDocument = async () => {
    const {
      versionedDocumentStore: documentStore,
      versionedProjectStore: projectStore,
      projectId: projId,
      documentId,
      filePath,
    } = await Effect.runPromise(
      projectStoreManager.openSingleDocumentProjectStore({
        openFile: filesystem.openFile,
      })()
    );

    setProjectId(projId);
    setVersionedProjectStore(projectStore);
    setVersionedDocumentStore(documentStore);

    return { documentId, path: filePath! };
  };

  return (
    <SingleDocumentProjectContext.Provider
      value={{
        projectId,
        versionedProjectStore,
        createNewDocument: handleCreateNewDocument,
        openDocument: handleOpenDocument,
      }}
    >
      {children}
    </SingleDocumentProjectContext.Provider>
  );
};
