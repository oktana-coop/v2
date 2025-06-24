import { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router';

import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/electron-context';
import { type File } from '../../../../modules/infrastructure/filesystem';
import { isValidVersionControlId } from '../../../../modules/infrastructure/version-control';
import { type VersionControlId } from '../../../../modules/infrastructure/version-control';
import {
  RecentProjectsContext,
  SingleDocumentProjectContext,
} from '../../../app-state';

export const useDocumentSelection = () => {
  const navigate = useNavigate();
  const { isElectron } = useContext(ElectronContext);
  const { openDocument } = useContext(SingleDocumentProjectContext);
  const { recentProjects } = useContext(RecentProjectsContext);

  const selectDocument = async ({
    projectId,
    documentId,
    file,
  }: {
    projectId: VersionControlId;
    documentId: VersionControlId;
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

    navigate(`/documents/${documentId}`);
  };

  return useCallback(
    async (id: string) => {
      if (!isValidVersionControlId(id)) {
        throw new Error(`Invalid document ID: ${id}`);
      }

      const projectInfo = recentProjects.find((proj) => proj.documentId === id);

      if (!projectInfo) {
        throw new Error(
          `Project with documentId ${id} not found in recent projects`
        );
      }

      return selectDocument({
        documentId: id,
        projectId: projectInfo.projectId,
        file: projectInfo.projectFile,
      });
    },
    [recentProjects]
  );
};
