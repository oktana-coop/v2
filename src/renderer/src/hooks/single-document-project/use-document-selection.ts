import { useContext } from 'react';
import { useNavigate } from 'react-router';

import {
  CurrentDocumentContext,
  SingleDocumentProjectContext,
} from '../../../../modules/app-state';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/electron-context';
import { type File } from '../../../../modules/infrastructure/filesystem';
import { type VersionControlId } from '../../../../modules/infrastructure/version-control';

export const useDocumentSelection = () => {
  const { isElectron } = useContext(ElectronContext);

  const navigate = useNavigate();
  const { openDocument } = useContext(SingleDocumentProjectContext);
  const { setSelectedFileInfo } = useContext(CurrentDocumentContext);

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

      const { path } = await openDocument({ fromFile: file });

      await setSelectedFileInfo({
        documentId,
        path,
      });
      navigate(`/documents/${documentId}?path=${encodeURIComponent(path)}`);
    } else {
      await openDocument({ projectId });
      navigate(`/documents/${documentId}`);
    }
  };
};
