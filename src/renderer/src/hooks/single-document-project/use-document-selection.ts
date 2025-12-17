import { useCallback, useContext } from 'react';

import {
  isValidProjectId,
  type ProjectId,
} from '../../../../modules/domain/project';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import { type File } from '../../../../modules/infrastructure/filesystem';
import { type ResolvedArtifactId } from '../../../../modules/infrastructure/version-control';
import {
  RecentProjectsContext,
  SingleDocumentProjectContext,
} from '../../app-state';
import { useNavigateToDocument } from '../use-navigate-to-document';

export const useDocumentSelection = () => {
  const navigateToDocument = useNavigateToDocument();
  const { isElectron } = useContext(ElectronContext);
  const { openDocument } = useContext(SingleDocumentProjectContext);
  const { recentProjects } = useContext(RecentProjectsContext);

  const selectDocument = async ({
    projectId,
    documentId,
    file,
  }: {
    projectId: ProjectId;
    documentId: ResolvedArtifactId;
    file: File | null;
  }) => {
    if (isElectron) {
      if (!file) {
        throw new Error(
          'File must be provided when opening a document in the desktop app'
        );
      }

      await openDocument({ fromFile: file });
    } else {
      await openDocument({ projectId });
    }

    navigateToDocument({ projectId, documentId, path: file?.path ?? null });
  };

  return useCallback(
    async (id: string) => {
      if (!isValidProjectId(id)) {
        throw new Error(`Invalid project ID: ${id}`);
      }

      const projectInfo = recentProjects.find((proj) => proj.projectId === id);

      if (!projectInfo) {
        throw new Error(
          `Project with projectId ${id} not found in recent projects`
        );
      }

      return selectDocument({
        projectId: id,
        documentId: projectInfo.documentId,
        file: projectInfo.projectFile,
      });
    },
    [recentProjects]
  );
};
