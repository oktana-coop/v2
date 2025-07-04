import * as Effect from 'effect/Effect';
import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { type SingleDocumentProjectStore } from '../../../../modules/domain/project';
import { type File } from '../../../../modules/infrastructure/filesystem';
import { VersionControlId } from '../../../../modules/infrastructure/version-control';
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
  createNewDocument: (name?: string) => Promise<{
    projectId: VersionControlId;
    documentId: VersionControlId;
    path: string | null;
  }>;
  openDocument: (args?: {
    fromFile?: File;
    projectId?: VersionControlId;
  }) => Promise<{
    projectId: VersionControlId;
    documentId: VersionControlId;
    path: string | null;
  }>;
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
  const navigate = useNavigate();

  useEffect(() => {
    const getSelectedProject = async () => {
      // Check if we have a project ID in the browser storage
      const browserStorageBrowserDataValue = localStorage.getItem(
        BROWSER_STORAGE_PROJECT_DATA_KEY
      );
      const browserStorageProjectData = browserStorageBrowserDataValue
        ? (JSON.parse(
            browserStorageBrowserDataValue
          ) as BrowserStorageProjectData)
        : null;

      if (browserStorageProjectData?.projectId) {
        const {
          versionedDocumentStore: documentStore,
          versionedProjectStore: projectStore,
          documentId: docId,
          file,
          name: projName,
        } = await Effect.runPromise(
          singleDocumentProjectStoreManager.openSingleDocumentProjectStore({
            openFile: filesystem.openFile,
          })({
            fromFile: browserStorageProjectData.file ?? undefined,
            projectId: browserStorageProjectData.projectId,
          })
        );

        setVersionedProjectStore(projectStore);
        setVersionedDocumentStore(documentStore);
        setProjectId(browserStorageProjectData.projectId);
        setDocumentId(docId);
        setProjectFile(file);
        setProjectName(projName);

        navigate(
          `/projects/${browserStorageProjectData.projectId}/documents/${docId}`
        );
      }
    };

    getSelectedProject();
  }, []);

  const handleCreateNewDocument = async (name?: string) => {
    if (versionedProjectStore) {
      await Effect.runPromise(versionedProjectStore.disconnect());

      setVersionedProjectStore(null);
      setVersionedDocumentStore(null);
    }

    const {
      versionedDocumentStore: documentStore,
      versionedProjectStore: projectStore,
      projectId: projId,
      documentId: docId,
      file,
      name: projName,
    } = await Effect.runPromise(
      singleDocumentProjectStoreManager.setupSingleDocumentProjectStore({
        createNewFile: filesystem.createNewFile,
      })({ name })
    );

    setVersionedProjectStore(projectStore);
    setVersionedDocumentStore(documentStore);
    setProjectId(projId);
    setDocumentId(docId);
    setProjectFile(file);
    setProjectName(projName);

    const browserStorageProjectData: BrowserStorageProjectData = {
      projectId: projId,
      documentId: docId,
      file,
    };
    localStorage.setItem(
      BROWSER_STORAGE_PROJECT_DATA_KEY,
      JSON.stringify(browserStorageProjectData)
    );

    return { projectId: projId, documentId: docId, path: file?.path ?? null };
  };

  const handleOpenDocument = async (args?: {
    fromFile?: File;
    projectId?: VersionControlId;
  }) => {
    if (versionedProjectStore) {
      await Effect.runPromise(versionedProjectStore.disconnect());

      setVersionedProjectStore(null);
      setVersionedDocumentStore(null);
    }

    const {
      versionedDocumentStore: documentStore,
      versionedProjectStore: projectStore,
      projectId: projId,
      documentId: docId,
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

    setVersionedProjectStore(projectStore);
    setVersionedDocumentStore(documentStore);
    setProjectId(projId);
    setDocumentId(docId);
    setProjectFile(file);
    setProjectName(projName);

    const browserStorageProjectData: BrowserStorageProjectData = {
      projectId: projId,
      documentId: docId,
      file,
    };
    localStorage.setItem(
      BROWSER_STORAGE_PROJECT_DATA_KEY,
      JSON.stringify(browserStorageProjectData)
    );

    return { projectId: projId, documentId: docId, path: file?.path ?? null };
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
