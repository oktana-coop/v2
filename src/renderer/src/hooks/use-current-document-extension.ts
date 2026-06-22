import { useContext } from 'react';

import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  richTextRepresentationExtensions,
} from '../../../modules/domain/rich-text';
import { getExtension } from '../../../modules/infrastructure/filesystem';
import { ProjectContext } from '../app-state';

const SUPPORTED_EXTENSIONS = new Set([
  richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION],
]);

export const isUnsupportedExtension = (path: string): boolean => {
  const extension = getExtension(path).toLowerCase();
  return !SUPPORTED_EXTENSIONS.has(extension);
};

export const useCurrentDocumentExtension = () => {
  const { selectedFileInfo } = useContext(ProjectContext);

  const extension = selectedFileInfo?.path
    ? getExtension(selectedFileInfo.path).toLowerCase()
    : null;

  const isUnsupported =
    extension != null && !SUPPORTED_EXTENSIONS.has(extension);

  return { extension, isUnsupported };
};
