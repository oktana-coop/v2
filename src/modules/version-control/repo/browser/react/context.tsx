import { createContext, useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../../../electron';
import {
  type Directory,
  File,
  FilesystemContext,
  type FilesystemContextType,
} from '../../../../filesystem';
import { createAdapter } from '../../../adapters/automerge';
import {
  DocumentMetaData,
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

const createVersionedDocument =
  ({
    repo,
    readFile,
  }: {
    repo: VersionControlRepo;
    readFile: FilesystemContextType['readFile'];
  }) =>
  async ({ file, projectId }: { file: File; projectId: VersionControlId }) => {
    const readFileResult = await readFile(file.path!);
    const documentId = await repo.createDocument({
      path: readFileResult.path!,
      name: readFileResult.name,
      title: readFileResult.name,
      content: readFileResult.content ?? null,
      projectId,
    });

    return {
      versionControlId: documentId,
      path: readFileResult.path!,
      name: readFileResult.name,
    };
  };

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
  const { directory, directoryFiles, readFile } = useContext(FilesystemContext);

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
        let newProjectId: VersionControlId;
        if (
          browserStorageProjectData?.directoryName === directory.name &&
          browserStorageProjectData?.directoryPath === directory.path
        ) {
          // If we have a project ID and it matches the new directory name & path,
          // we already have its version control ID. Return it and set it in the state.
          newProjectId = browserStorageProjectData.versionControlId;

          // Check if we need to update the project documents
          const projectHandle = await versionControlRepo.findProjectById(
            browserStorageProjectData.versionControlId
          );
          if (!projectHandle) {
            throw new Error('No project handle found in repository');
          }

          const project = projectHandle.docSync() as
            | VersionedProject
            | undefined;

          if (project) {
            const newDocuments = await Promise.all(
              directoryFiles
                // Filter out existing documents
                .filter(
                  (file) =>
                    !Object.values(project.documents).some(
                      (docMetaData) =>
                        docMetaData.name === file.name &&
                        docMetaData.path === file.path
                    )
                )
                .map((file) =>
                  createVersionedDocument({
                    repo: versionControlRepo,
                    readFile,
                  })({
                    file,
                    projectId: newProjectId,
                  })
                )
            );

            if (newDocuments.length > 0) {
              projectHandle.change((proj) => {
                newDocuments.forEach((doc) => {
                  proj.documents[doc.versionControlId] = doc;
                });
              });
            }
          }
        } else {
          // If there is no project ID or if there is one but points to another directory
          // we want to setup a new project and create versioned documents for each of its eligible files.
          // Finally, we want to store the project ID in the local storage and set it in the state.

          const documents = await Promise.all(
            directoryFiles.map((file) =>
              createVersionedDocument({ repo: versionControlRepo, readFile })({
                file,
                projectId: newProjectId,
              })
            )
          );

          newProjectId = await versionControlRepo.createProject({
            path: directory.path!,
            documents: documents.reduce(
              (acc, doc) => {
                return { ...acc, [doc.versionControlId]: doc };
              },
              {} as Record<VersionControlId, DocumentMetaData>
            ),
          });

          localStorage.setItem(
            BROWSER_STORAGE_PROJECT_DATA_KEY,
            JSON.stringify({
              directoryName: directory.name,
              directoryPath: directory.path,
              versionControlId: newProjectId,
            })
          );
        }

        setProjectId(newProjectId);
      } else {
        setProjectId(null);
      }
    };

    openOrCreateProject();
  }, [directory, directoryFiles, versionControlRepo]);

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
      throw new Error('No project found in repository');
    }

    const project = projectHandle.docSync() as VersionedProject;

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
