import { useContext } from 'react';

import {
  CurrentDocumentContext,
  MultiDocumentProjectContext,
} from '../../../../modules/app-state';
import { removeExtension } from '../../../../modules/infrastructure/filesystem';
import { type DocumentListItem } from '../types';

export const useDocumentList = () => {
  const { directoryFiles } = useContext(MultiDocumentProjectContext);
  const { selectedFileInfo } = useContext(CurrentDocumentContext);

  return () =>
    directoryFiles.map((file) => {
      const documentListItem: DocumentListItem = {
        id: file.path,
        name: removeExtension(file.name),
        isSelected: selectedFileInfo?.path === file.path,
      };

      return documentListItem;
    });
};
