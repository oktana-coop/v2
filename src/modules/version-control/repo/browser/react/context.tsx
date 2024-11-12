import { createContext, useContext, useEffect, useState } from 'react';

import { ElectronContext } from '../../../../electron';
import { type Directory, FilesystemContext } from '../../../../filesystem';
import { createAdapter } from '../../../adapters/automerge';
import { VersionControlId, VersionedDocumentHandle } from '../../../models';
import {
  CreateDocumentArgs,
  VersionControlRepo,
} from '../../../ports/version-control-repo';
import { setup as setupBrowserRepo } from '../setup';

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
  const { processId } = useContext(ElectronContext);
  const { directory } = useContext(FilesystemContext);

  useEffect(() => {
    const setupVersionControlRepo = async () => {
      if (processId) {
        const automergeRepo = await setupBrowserRepo(processId);
        const vcRepo = createAdapter(automergeRepo);
        setVersionControlRepo(vcRepo);
        setIsRepoReady(true);
      } else {
        setIsRepoReady(false);
      }
    };

    setupVersionControlRepo();
  }, [processId]);

  useEffect(() => {
    const openOrCreateProject = async () => {
      if (!versionControlRepo) {
        return;
      }

      if (directory) {
        const browserStorageBrowserDataValue = localStorage.getItem(
          BROWSER_STORAGE_PROJECT_DATA_KEY
        );

        const browserStorageBrowserData = browserStorageBrowserDataValue
          ? (JSON.parse(
              browserStorageBrowserDataValue
            ) as BrowserStorageProjectData)
          : null;

        let versionControlId: VersionControlId;
        if (
          browserStorageBrowserData?.directoryName === directory.name &&
          browserStorageBrowserData?.directoryPath === directory.path
        ) {
          versionControlId = browserStorageBrowserData.versionControlId;
        } else {
          versionControlId = await versionControlRepo.createProject();

          localStorage.setItem(
            BROWSER_STORAGE_PROJECT_DATA_KEY,
            JSON.stringify({
              directoryName: directory.name,
              directoryPath: directory.path,
              versionControlId,
            })
          );
        }

        setProjectId(versionControlId);
      }

      setProjectId(null);
    };

    openOrCreateProject();
  }, [directory, versionControlRepo]);

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

    const project = (
      await versionControlRepo.findProjectById(projectId)
    )?.docSync();

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
