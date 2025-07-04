import { createContext } from 'react';

import {
  type ProjectType,
  projectTypes,
} from '../../../../modules/domain/project';
import { RecentProjectsProvider } from '../recent-projects/context';
import { MultiDocumentProjectProvider } from './multi-document-project-context';
import { SingleDocumentProjectProvider } from './single-document-project-context';

export type CurrentProjectContextType = {
  projectType: ProjectType;
};

export const CurrentProjectContext = createContext<CurrentProjectContextType>({
  projectType: projectTypes.SINGLE_DOCUMENT_PROJECT,
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
  return (
    <CurrentProjectContext.Provider
      value={{
        projectType,
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
