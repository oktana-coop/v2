import { useContext } from 'react';

import {
  PROJECT_FILE_EXTENSION,
  projectTypes,
} from '../../../modules/domain/project';
import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  richTextRepresentationExtensions,
} from '../../../modules/domain/rich-text';
import { getExtension } from '../../../modules/infrastructure/filesystem';
import {
  CurrentProjectContext,
  MultiDocumentProjectContext,
} from '../app-state';

const SUPPORTED_EXTENSIONS = new Set([
  richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION],
  PROJECT_FILE_EXTENSION,
]);

export const useCurrentDocumentExtension = () => {
  const { projectType } = useContext(CurrentProjectContext);
  const { selectedFileInfo } = useContext(MultiDocumentProjectContext);

  const extension =
    projectType === projectTypes.SINGLE_DOCUMENT_PROJECT
      ? PROJECT_FILE_EXTENSION
      : selectedFileInfo?.path
        ? getExtension(selectedFileInfo.path).toLowerCase()
        : null;

  const isUnsupported =
    extension != null && !SUPPORTED_EXTENSIONS.has(extension);

  return { extension, isUnsupported };
};
