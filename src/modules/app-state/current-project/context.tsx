import { createContext, useContext, useEffect, useState } from 'react';

import { type ProjectType, projectTypes } from '../../domain/project';
import { type File } from '../../infrastructure/filesystem';
import { VersionControlId } from '../../infrastructure/version-control';
import {
  MultiDocumentProjectContext,
  MultiDocumentProjectProvider,
} from './multi-document-project-context';
import {
  SingleDocumentProjectContext,
  SingleDocumentProjectProvider,
} from './single-document-project-context';

export type CurrentProjectContextType = {
  projectType: ProjectType;
  projectId: VersionControlId | null;
  canCreateDocument: () => boolean;
  canShowFiles: () => boolean;
  files: Array<File>;
  createNewDocument: (
    suggestedName: string
  ) => Promise<{ documentId: VersionControlId; path: string }>;
};

export const CurrentProjectContext = createContext<CurrentProjectContextType>({
  projectType: projectTypes.SINGLE_DOCUMENT_PROJECT,
  projectId: null,
  canCreateDocument: () => false,
  canShowFiles: () => false,
  files: [],
  // @ts-expect-error will get overriden below
  createNewDocument: async () => {},
});

const ProjectProviderSelector = ({
  projectType,
  children,
}: {
  projectType: ProjectType;
  children: React.ReactNode;
}) =>
  projectType === projectTypes.SINGLE_DOCUMENT_PROJECT ? (
    <SingleDocumentProjectProvider>{children}</SingleDocumentProjectProvider>
  ) : (
    <MultiDocumentProjectProvider>{children}</MultiDocumentProjectProvider>
  );

// The responsibilities of this provider are to:
// 1. Pick the correct underlying provider (multi/single-document project)
// 2. Expose a common interface between the two providers.
// This way, the components can be more agnostic to what type of project they're using.
const ProjectInterfaceProvider = ({
  projectType,
  children,
}: {
  projectType: ProjectType;
  children: React.ReactNode;
}) => {
  const [files, setFiles] = useState<Array<File>>([]);
  const [projectId, setProjectId] = useState<VersionControlId | null>(null);

  const {
    projectId: multiDocumentProjectId,
    canCreateDocument: canCreateDocumentInMultiFileProject,
    canShowFiles: canShowFilesInMultiFileProject,
    directoryFiles,
    createNewDocument: createNewDocumentInMultiFileProject,
  } = useContext(MultiDocumentProjectContext);
  const {
    projectId: singleDocumentProjectId,
    createNewDocument: createNewDocumentInSingleFileProject,
  } = useContext(SingleDocumentProjectContext);

  useEffect(() => {
    if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
      setProjectId(multiDocumentProjectId);
    } else {
      setProjectId(singleDocumentProjectId);
    }
  }, [projectType, multiDocumentProjectId, singleDocumentProjectId]);

  useEffect(() => {
    if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
      setFiles(directoryFiles);
    }
  }, [projectType, directoryFiles]);

  return (
    <CurrentProjectContext.Provider
      value={{
        projectType,
        projectId,
        canCreateDocument:
          projectType === projectTypes.MULTI_DOCUMENT_PROJECT
            ? canCreateDocumentInMultiFileProject
            : () => true,
        canShowFiles:
          projectType === projectTypes.MULTI_DOCUMENT_PROJECT
            ? canShowFilesInMultiFileProject
            : () => false,
        createNewDocument:
          projectType === projectTypes.MULTI_DOCUMENT_PROJECT
            ? createNewDocumentInMultiFileProject
            : createNewDocumentInSingleFileProject,
        files,
      }}
    >
      {children}
    </CurrentProjectContext.Provider>
  );
};

export const CurrentProjectProvider = ({
  projectType,
  children,
}: {
  projectType: ProjectType;
  children: React.ReactNode;
}) => {
  return (
    <ProjectProviderSelector projectType={projectType}>
      <ProjectInterfaceProvider projectType={projectType}>
        {children}
      </ProjectInterfaceProvider>
    </ProjectProviderSelector>
  );
};
