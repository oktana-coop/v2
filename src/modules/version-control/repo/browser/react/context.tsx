import { createContext, useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../../../electron';
import { type Directory, FilesystemContext } from '../../../../filesystem';
import { createAdapter } from '../../../adapters/automerge';
import {
  createProjectFromFilesystemContent,
  updateProjectFromFilesystemContent,
} from '../../../commands';
import {
  VersionControlId,
  VersionedDocumentHandle,
  VersionedProject,
} from '../../../models';
import {
  CreateDocumentArgs,
  VersionControlRepo,
} from '../../../ports/version-control-repo';
import {
  setupForElectron as setupBrowserRepoForElectron,
  setupForWeb as setupBrowserRepoForWeb,
} from '../setup';

type BrowserStorageProjectData = {
  directoryName: Directory['name'];
  directoryPath: Directory['path'];
  versionControlId: VersionControlId;
};

const BROWSER_STORAGE_PROJECT_DATA_KEY = 'project';

type FindDocumentInProjectArgs = {
  projectId: VersionControlId;
  path: string;
  name: string;
};

type VersionControlContextType = {
  isRepoReady: boolean;
  projectId: VersionControlId | null;
  createDocument: (args: CreateDocumentArgs) => Promise<VersionControlId>;
  findDocument: (
    id: VersionControlId
  ) => Promise<VersionedDocumentHandle | null>;
  findDocumentInProject: (
    args: FindDocumentInProjectArgs
  ) => Promise<VersionedDocumentHandle | null>;
};

export const VersionControlContext = createContext<VersionControlContextType>({
  isRepoReady: false,
  projectId: null,
  // @ts-expect-error will get overriden below
  createDocument: () => null,
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
  const [projectId, setProjectId] = useState<VersionControlId | null>(null);
  const { processId, isElectron } = useContext(ElectronContext);
  const { directory, readFile, listDirectoryFiles } =
    useContext(FilesystemContext);

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

  useEffect(() => {
    const openOrCreateProject = async () => {
      if (!versionControlRepo) {
        return;
      }

      if (directory) {
        // Check if we have a project ID in the browser storage
        const browserStorageBrowserDataValue = localStorage.getItem(
          BROWSER_STORAGE_PROJECT_DATA_KEY
        );
        const browserStorageProjectData = browserStorageBrowserDataValue
          ? (JSON.parse(
              browserStorageBrowserDataValue
            ) as BrowserStorageProjectData)
          : null;

        // Perform some side effects conditionally and store the (potentially) new
        // project ID in local storage
        let projId: VersionControlId;
        if (
          browserStorageProjectData?.directoryName === directory.name &&
          browserStorageProjectData?.directoryPath === directory.path
        ) {
          // If we have a project ID and it matches the new directory name & path,
          // we already have its version control ID. Return it and set it in the state.
          projId = browserStorageProjectData.versionControlId;

          if (isElectron) {
            // Delegate opening the project to the main process
            await window.versionControlAPI.openProject({
              projectId: projId,
              directoryPath: directory.path!,
            });
          } else {
            await updateProjectFromFilesystemContent({
              createDocument: versionControlRepo.createDocument,
              listProjectDocuments: versionControlRepo.listProjectDocuments,
              findDocumentInProject: versionControlRepo.findDocumentInProject,
              updateDocumentSpans: versionControlRepo.updateDocumentSpans,
              deleteDocumentFromProject:
                versionControlRepo.deleteDocumentFromProject,
              listDirectoryFiles: listDirectoryFiles,
              readFile: readFile,
            })({
              projectId: projId,
              directoryPath: directory.path!,
            });
          }
        } else {
          if (isElectron) {
            // Delegate opening/creating the project to the main process
            projId = await window.versionControlAPI.openOrCreateProject({
              directoryPath: directory.path!,
            });
          } else {
            projId = await createProjectFromFilesystemContent({
              createProject: versionControlRepo.createProject,
              createDocument: versionControlRepo.createDocument,
              listDirectoryFiles: listDirectoryFiles,
              readFile: readFile,
            })({
              directoryPath: directory.path!,
            });
          }

          localStorage.setItem(
            BROWSER_STORAGE_PROJECT_DATA_KEY,
            JSON.stringify({
              directoryName: directory.name,
              directoryPath: directory.path,
              versionControlId: projId,
            })
          );
        }

        setProjectId(projId);
      } else {
        setProjectId(null);
      }
    };

    openOrCreateProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory, isElectron, versionControlRepo]);

  const handleCreateDocument = async (args: CreateDocumentArgs) => {
    if (!versionControlRepo) {
      throw new Error('No repo found when trying to create document');
    }

    return versionControlRepo.createDocument(args);
  };

  const handleFindDocument = async (id: VersionControlId) => {
    if (!versionControlRepo) {
      throw new Error('No repo found when trying to create document');
    }

    return versionControlRepo.findDocumentById(id);
  };

  const handleFindDocumentInProject = async ({
    projectId,
    path,
    name,
  }: FindDocumentInProjectArgs) => {
    if (!versionControlRepo) {
      throw new Error('No repo found when trying to find file in project');
    }

    const projectHandle = await versionControlRepo.findProjectById(projectId);
    if (!projectHandle) {
      throw new Error('No project handle found in repository');
    }

    const project = projectHandle.docSync() as VersionedProject | undefined;

    if (!project) {
      throw new Error('No project found in repository');
    }

    const documentMetaData = Object.values(project.documents).find(
      ({ name: documentName, path: documentPath }) =>
        documentName === name && documentPath === path
    );

    if (!documentMetaData) {
      return null;
    }

    const document = await versionControlRepo.findDocumentById(
      documentMetaData.versionControlId
    );

    return document;
  };

  return (
    <VersionControlContext.Provider
      value={{
        isRepoReady,
        projectId,
        createDocument: handleCreateDocument,
        findDocument: handleFindDocument,
        findDocumentInProject: handleFindDocumentInProject,
      }}
    >
      {children}
    </VersionControlContext.Provider>
  );
};
