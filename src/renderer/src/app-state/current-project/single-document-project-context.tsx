import * as Effect from 'effect/Effect';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router';

import {
  type ProjectId,
  type SingleDocumentProjectStore,
} from '../../../../modules/domain/project';
import { isElectron } from '../../../../modules/infrastructure/cross-platform/utils';
import { type File } from '../../../../modules/infrastructure/filesystem';
import { type ResolvedArtifactId } from '../../../../modules/infrastructure/version-control';
import { InfrastructureAdaptersContext } from '../infrastructure-adapters/context';

export type BrowserStorageProjectData = {
  projectId: ProjectId;
  documentId: ResolvedArtifactId;
  file: File | null;
};

export const BROWSER_STORAGE_PROJECT_DATA_KEY = 'single-document-project';

export type SingleDocumentProjectContextType = {
  loading: boolean;
  projectId: ProjectId | null;
  documentId: ResolvedArtifactId | null;
  projectFile: File | null;
  projectName: string | null;
  versionedProjectStore: SingleDocumentProjectStore | null;
  createNewDocument: (name?: string) => Promise<{
    projectId: ProjectId;
    documentId: ResolvedArtifactId;
    path: string | null;
  }>;
  openDocument: (args?: { fromFile?: File; projectId?: ProjectId }) => Promise<{
    projectId: ProjectId | null;
    documentId: ResolvedArtifactId | null;
    path: string | null;
  }>;
};

export const SingleDocumentProjectContext =
  createContext<SingleDocumentProjectContextType>({
    loading: false,
    projectId: null,
    projectFile: null,
    projectName: null,
    // @ts-expect-error will get overriden below
    createNewDocument: () => null,
    // @ts-expect-error will get overriden below
    openDocument: () => null,
    versionedProjectStore: null,
  });

const getFileToBeOpenedFromSessionStorage = (): File | null => {
  const fileToBeOpened = sessionStorage.getItem('fileToBeOpened');

  if (fileToBeOpened) {
    try {
      const parsedFile = JSON.parse(fileToBeOpened) as File;
      return parsedFile;
    } catch {
      console.error('Error parsing file to be opened from session storage');
    }
  }

  return null;
};

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
  const [loading, setLoading] = useState<boolean>(false);
  const [projectId, setProjectId] = useState<ProjectId | null>(null);
  const [documentId, setDocumentId] = useState<ResolvedArtifactId | null>(null);
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [versionedProjectStore, setVersionedProjectStore] =
    useState<SingleDocumentProjectStore | null>(null);
  const [fileToBeOpened, setFileToBeOpened] = useState<File | null>(null);
  const navigate = useNavigate();
  const { projectId: projectIdInPath } = useParams();

  useEffect(() => {
    if (!isElectron()) {
      return;
    }

    setFileToBeOpened(getFileToBeOpenedFromSessionStorage());

    const unsubscribe = window.osEventsAPI.onOpenFileFromFilesystem(
      (file: File) => {
        setFileToBeOpened(file);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const openAndSelectFileFromOsEvent = async (file: File) => {
      const openedDocument = await handleOpenDocument({ fromFile: file });
      setLoading(false);
      navigate(
        `/projects/${openedDocument.projectId}/documents/${openedDocument.documentId}`
      );
    };

    if (fileToBeOpened) {
      openAndSelectFileFromOsEvent(fileToBeOpened);
    } else {
      openRecentProjectFromBrowserStorage();
    }
  }, [fileToBeOpened]);

  const openRecentProjectFromBrowserStorage = async () => {
    setLoading(true);
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

    setLoading(false);
  };

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

  const handleOpenDocument = useCallback(
    async (args?: {
      fromFile?: File;
      projectId?: ProjectId;
      forceOpen?: boolean;
    }) => {
      try {
        // Check if document (and project) is already opened
        if (
          !args?.forceOpen &&
          args?.projectId &&
          projectId &&
          documentId &&
          projectIdInPath &&
          projectId === projectIdInPath
        ) {
          return { projectId, documentId, path: projectFile?.path ?? null };
        }

        setLoading(true);

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

        setLoading(false);

        return {
          projectId: projId,
          documentId: docId,
          path: file?.path ?? null,
        };
      } catch {
        // Restore previous state if opening failed
        if (
          projectId &&
          documentId &&
          projectIdInPath &&
          projectId === projectIdInPath
        ) {
          return handleOpenDocument({
            projectId,
            fromFile: projectFile ?? undefined,
            forceOpen: true,
          });
        } else {
          return { projectId: null, documentId: null, path: null };
        }
      }
    },
    [projectIdInPath]
  );

  return (
    <SingleDocumentProjectContext.Provider
      value={{
        loading,
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
