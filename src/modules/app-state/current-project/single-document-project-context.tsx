import * as Effect from 'effect/Effect';
import { createContext, useContext, useEffect, useState } from 'react';

import { type SingleDocumentProjectStore } from '../../domain/project';
import { type File } from '../../infrastructure/filesystem';
import { VersionControlId } from '../../infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';

export type BrowserStorageProjectData = {
  projectId: VersionControlId;
  documentId: VersionControlId;
  file: File | null;
};

export const BROWSER_STORAGE_PROJECT_DATA_KEY = 'single-document-project';

export type SingleDocumentProjectContextType = {
  projectId: VersionControlId | null;
  documentId: VersionControlId | null;
  projectFile: File | null;
  projectName: string | null;
  versionedProjectStore: SingleDocumentProjectStore | null;
  createNewDocument: (
    suggestedName: string
  ) => Promise<{ documentId: VersionControlId; path: string }>;
  openDocument: (args?: {
    fromFile?: File;
    projectId?: VersionControlId;
  }) => Promise<{ documentId: VersionControlId; path: string }>;
};

export const SingleDocumentProjectContext =
  createContext<SingleDocumentProjectContextType>({
    projectId: null,
    projectFile: null,
    projectName: null,
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
  const {
    filesystem,
    singleDocumentProjectStoreManager,
    setVersionedDocumentStore,
  } = useContext(InfrastructureAdaptersContext);
  const [projectId, setProjectId] = useState<VersionControlId | null>(null);
  const [documentId, setDocumentId] = useState<VersionControlId | null>(null);
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [versionedProjectStore, setVersionedProjectStore] =
    useState<SingleDocumentProjectStore | null>(null);

  // useEffect(() => {
  //   const getSelectedProject = async () => {
  //     // Check if we have a project ID in the browser storage
  //     const browserStorageBrowserDataValue = localStorage.getItem(
  //       BROWSER_STORAGE_PROJECT_DATA_KEY
  //     );
  //     const browserStorageProjectData = browserStorageBrowserDataValue
  //       ? (JSON.parse(
  //           browserStorageBrowserDataValue
  //         ) as BrowserStorageProjectData)
  //       : null;

  //     if (browserStorageProjectData?.projectId) {
  //       const {
  //         versionedDocumentStore: documentStore,
  //         versionedProjectStore: projectStore,
  //         file,
  //       } = await Effect.runPromise(
  //         singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
  //           openFile: filesystem.openFile,
  //         })({ projectId: browserStorageProjectData.projectId })
  //       );

  //       setProjectId(browserStorageProjectData.projectId);
  //       setProjectFile(file);
  //       setVersionedProjectStore(projectStore);
  //       setVersionedDocumentStore(documentStore);
  //     }
  //   };

  //   getSelectedProject();
  // }, []);

  const handleCreateNewDocument = async (name?: string) => {
    const {
      versionedDocumentStore: documentStore,
      versionedProjectStore: projectStore,
      projectId: projId,
      documentId,
      file,
      name: projName,
    } = await Effect.runPromise(
      singleDocumentProjectStoreManager.setupSingleDocumentProjectStore({
        createNewFile: filesystem.createNewFile,
      })({ name })
    );

    setProjectId(projId);
    setDocumentId(documentId);
    setProjectFile(file);
    setProjectName(projName);
    setVersionedProjectStore(projectStore);
    setVersionedDocumentStore(documentStore);

    const browserStorageProjectData: BrowserStorageProjectData = {
      projectId: projId,
      documentId,
      file,
    };
    localStorage.setItem(
      BROWSER_STORAGE_PROJECT_DATA_KEY,
      JSON.stringify(browserStorageProjectData)
    );

    // TODO: Handle browser case, where we won't be getting a file.
    return { documentId, path: file?.path ?? null };
  };

  const handleOpenDocument = async (args?: {
    fromFile?: File;
    projectId?: VersionControlId;
  }) => {
    const {
      versionedDocumentStore: documentStore,
      versionedProjectStore: projectStore,
      projectId: projId,
      documentId,
      file,
      name: projName,
    } = await Effect.runPromise(
      args
        ? singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
            openFile: filesystem.openFile,
          })({ fromFile: args.fromFile, projectId: args.projectId })
        : singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
            openFile: filesystem.openFile,
          })({})
    );

    setProjectId(projId);
    setDocumentId(documentId);
    setProjectFile(file);
    setProjectName(projName);
    setVersionedProjectStore(projectStore);
    setVersionedDocumentStore(documentStore);

    const browserStorageProjectData: BrowserStorageProjectData = {
      projectId: projId,
      documentId,
      file,
    };
    localStorage.setItem(
      BROWSER_STORAGE_PROJECT_DATA_KEY,
      JSON.stringify(browserStorageProjectData)
    );

    // TODO: Handle browser case, where we won't be getting a file.
    return { documentId, path: file?.path ?? null };
  };

  return (
    <SingleDocumentProjectContext.Provider
      value={{
        projectId,
        documentId,
        projectFile,
        projectName,
        versionedProjectStore,
        createNewDocument: handleCreateNewDocument,
        openDocument: handleOpenDocument,
      }}
    >
      {children}
    </SingleDocumentProjectContext.Provider>
  );
};
