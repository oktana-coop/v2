import { createContext, useContext, useEffect, useState } from 'react';

import {
  type ProjectType,
  projectTypes,
} from '../../../modules/domain/project';
import { type File } from '../../../modules/infrastructure/filesystem';
import { VersionControlId } from '../../../modules/infrastructure/version-control';
import { SingleDocumentProjectContext } from '../current-project/single-document-project-context';

type RecentProjectInfo = {
  projectId: VersionControlId;
  projectType: ProjectType;
  firstOpenedAt: Date;
  lastOpenedAt: Date;
};

type RecentSingleDocumentProjectInfo = RecentProjectInfo & {
  projectType: typeof projectTypes.SINGLE_DOCUMENT_PROJECT;
  documentId: VersionControlId;
  projectFile: File | null;
  projectName: string | null;
};

const BROWSER_STORAGE_RECENT_PROJECTS_KEY = 'recent-projects';

export type RecentProjectsContextType = {
  recentProjects: Array<RecentSingleDocumentProjectInfo>;
};

export const RecentProjectsContext = createContext<RecentProjectsContextType>({
  recentProjects: [],
});

const getRecentProjectsFromLocalStorage = () => {
  const recentProjectsItem = localStorage.getItem(
    BROWSER_STORAGE_RECENT_PROJECTS_KEY
  );
  if (!recentProjectsItem) return [];
  const parsed = JSON.parse(
    recentProjectsItem
  ) as Array<RecentSingleDocumentProjectInfo>;
  return parsed.map((proj) => ({
    ...proj,
    firstOpenedAt: new Date(proj.firstOpenedAt),
    lastOpenedAt: new Date(proj.lastOpenedAt),
  }));
};

export const RecentProjectsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [recentProjects, setRecentProjects] = useState<
    Array<RecentSingleDocumentProjectInfo>
  >(getRecentProjectsFromLocalStorage());
  const { projectId, documentId, projectFile, projectName } = useContext(
    SingleDocumentProjectContext
  );

  useEffect(() => {
    const getUpdatedRecentProjects = ({
      projectId,
      documentId,
      projectFile,
      projectName,
    }: {
      projectId: VersionControlId;
      documentId: VersionControlId;
      projectFile: File | null;
      projectName: string | null;
    }) => {
      const existingEntryIndex = recentProjects.findIndex(
        (projectInfo) => projectInfo.projectId === projectId
      );

      // Project found in the list, update its last-opened date and replace the existing element, without re-sorting.
      if (existingEntryIndex >= 0) {
        const updatedProject: RecentSingleDocumentProjectInfo = {
          projectId,
          projectType: projectTypes.SINGLE_DOCUMENT_PROJECT,
          firstOpenedAt: recentProjects[existingEntryIndex].firstOpenedAt,
          lastOpenedAt: new Date(),
          documentId,
          projectFile,
          projectName,
        };

        const updatedRecentProjects = [...recentProjects];
        updatedRecentProjects.splice(existingEntryIndex, 1, updatedProject);

        return updatedRecentProjects;
      }

      // Project not found in the list, create one and add it.
      const newRecentProject: RecentSingleDocumentProjectInfo = {
        projectId,
        projectType: projectTypes.SINGLE_DOCUMENT_PROJECT,
        firstOpenedAt: new Date(),
        lastOpenedAt: new Date(),
        documentId,
        projectFile,
        projectName,
      };

      return [newRecentProject, ...recentProjects];
    };

    if (projectId && documentId) {
      const updatedRecentProjects = getUpdatedRecentProjects({
        projectId,
        documentId,
        projectFile,
        projectName,
      });

      setRecentProjects(updatedRecentProjects);

      // Re-sort by last-opened date descending order and save to local storage
      const sortedByLastOpenedDesc = [...updatedRecentProjects].sort(
        (projA, projB) =>
          projB.lastOpenedAt.getTime() - projA.lastOpenedAt.getTime()
      );
      localStorage.setItem(
        BROWSER_STORAGE_RECENT_PROJECTS_KEY,
        JSON.stringify(sortedByLastOpenedDesc)
      );
    }
  }, [projectId, documentId]);

  return (
    <RecentProjectsContext.Provider
      value={{
        recentProjects,
      }}
    >
      {children}
    </RecentProjectsContext.Provider>
  );
};
