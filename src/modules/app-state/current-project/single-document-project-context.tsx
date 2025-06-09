import * as Effect from 'effect/Effect';
import { createContext, useContext, useEffect, useState } from 'react';

import {
  createDocumentAndProject,
  type OpenSingleDocumentProjectStoreArgs,
  type SingleDocumentProjectStore,
} from '../../domain/project';
import { VersionedDocumentHandle } from '../../domain/rich-text';
import { ElectronContext } from '../../infrastructure/cross-platform/electron-context';
import { type Directory, type File } from '../../infrastructure/filesystem';
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
};

export const SingleDocumentProjectContext =
  createContext<SingleDocumentProjectContextType>({
    projectId: null,
    // @ts-expect-error will get overriden below
    createNewDocument: () => null,
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
      filePath,
    } = await Effect.runPromise(
      projectStoreManager.setupSingleDocumentProjectStore({
        createNewFile: filesystem.createNewFile,
      })({ suggestedName })
    );

    const { documentId, projectId: projId } = await Effect.runPromise(
      createDocumentAndProject({
        createDocument: documentStore.createDocument,
        createSingleDocumentProject: projectStore.createSingleDocumentProject,
      })({
        title: suggestedName,
        content: null,
      })
    );

    setProjectId(projId);
    setVersionedProjectStore(projectStore);
    setVersionedDocumentStore(documentStore);

    return { documentId, path: filePath! };
  };

  const openDocument = async ({
    filePath,
  }: OpenSingleDocumentProjectStoreArgs) => {
    const {
      versionedDocumentStore: documentStore,
      versionedProjectStore: projectStore,
    } = await Effect.runPromise(
      projectStoreManager.openSingleDocumentProjectStore({ filePath })
    );
  };

  return (
    <SingleDocumentProjectContext.Provider
      value={{
        projectId,
        versionedProjectStore,
        createNewDocument: handleCreateNewDocument,
      }}
    >
      {children}
    </SingleDocumentProjectContext.Provider>
  );
};
