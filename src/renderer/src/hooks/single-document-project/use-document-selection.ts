import { useContext } from 'react';
import { useNavigate } from 'react-router';

import { SingleDocumentProjectContext } from '../../../../modules/app-state';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/electron-context';
import { type File } from '../../../../modules/infrastructure/filesystem';
import { type VersionControlId } from '../../../../modules/infrastructure/version-control';

export const useDocumentSelection = () => {
  const { isElectron } = useContext(ElectronContext);

  const navigate = useNavigate();
  const { openDocument } = useContext(SingleDocumentProjectContext);

  return async ({
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
};
