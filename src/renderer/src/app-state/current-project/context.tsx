import { createContext, useContext, useEffect, useState } from 'react';

import {
  type ProjectType,
  projectTypes,
} from '../../../../modules/domain/project';
import { VersionControlId } from '../../../../modules/infrastructure/version-control';
import { RecentProjectsProvider } from '../recent-projects/context';
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
  path: string | null;
};

export const CurrentProjectContext = createContext<CurrentProjectContextType>({
  projectType: projectTypes.SINGLE_DOCUMENT_PROJECT,
  projectId: null,
  path: null,
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
    <SingleDocumentProjectProvider>
      <RecentProjectsProvider>{children}</RecentProjectsProvider>
    </SingleDocumentProjectProvider>
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
  const [projectId, setProjectId] = useState<VersionControlId | null>(null);

  const {
    projectId: multiDocumentProjectId,
    directory: multiDocumentProjectDirectory,
  } = useContext(MultiDocumentProjectContext);
  const {
    projectId: singleDocumentProjectId,
    projectFile: singleDocumentProjectFile,
  } = useContext(SingleDocumentProjectContext);

  useEffect(() => {
    if (projectType === projectTypes.MULTI_DOCUMENT_PROJECT) {
      setProjectId(multiDocumentProjectId);
    } else {
      setProjectId(singleDocumentProjectId);
    }
  }, [projectType, multiDocumentProjectId, singleDocumentProjectId]);

  return (
    <CurrentProjectContext.Provider
      value={{
        projectType,
        projectId,
        path:
          projectType === projectTypes.MULTI_DOCUMENT_PROJECT
            ? (multiDocumentProjectDirectory?.path ?? null)
            : (singleDocumentProjectFile?.path ?? null),
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
