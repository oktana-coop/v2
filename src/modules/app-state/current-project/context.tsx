import { createContext, useContext } from 'react';

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

export const CurrentProjectProvider = ({
  projectType,
  children,
}: {
  projectType: ProjectType;
  children: React.ReactNode;
}) => {
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

  return (
    <ProjectProviderSelector projectType={projectType}>
      <CurrentProjectContext.Provider
        value={{
          projectType,
          projectId: projectTypes.MULTI_DOCUMENT_PROJECT
            ? multiDocumentProjectId
            : singleDocumentProjectId,
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
          files:
            projectType === projectTypes.MULTI_DOCUMENT_PROJECT
              ? directoryFiles
              : // TODO: Replace with recent files in the single document project case
                [],
        }}
      >
        {children}
      </CurrentProjectContext.Provider>
    </ProjectProviderSelector>
  );
};
