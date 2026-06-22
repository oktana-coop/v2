import { useContext } from 'react';

import { PROJECT_FILE_EXTENSION } from '../../../modules/domain/project';
import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  richTextRepresentationExtensions,
} from '../../../modules/domain/rich-text';
import { getExtension } from '../../../modules/infrastructure/filesystem';
import { MultiDocumentProjectContext } from '../app-state';

const SUPPORTED_EXTENSIONS = new Set([
  richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION],
  PROJECT_FILE_EXTENSION,
]);

export const isUnsupportedExtension = (path: string): boolean => {
  const extension = getExtension(path).toLowerCase();
  return !SUPPORTED_EXTENSIONS.has(extension);
};

export const useCurrentDocumentExtension = () => {
  const { selectedFileInfo } = useContext(MultiDocumentProjectContext);

  const extension = selectedFileInfo?.path
    ? getExtension(selectedFileInfo.path).toLowerCase()
    : null;

  const isUnsupported =
    extension != null && !SUPPORTED_EXTENSIONS.has(extension);

  return { extension, isUnsupported };
};
