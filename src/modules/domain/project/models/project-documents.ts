import {
  type Directory,
  type File,
  isDirectory,
} from '../../../infrastructure/filesystem';
import { versionedArtifactTypes } from '../../../infrastructure/version-control';
import { inferArtifactTypeFromExtension } from './document-asset-paths';

// Filter function taking a project directory tree and returning only the files
// that the editor can open, descending into subdirectories and dropping
// directories and assets with unsupported extensions.
export const listOpenableDocuments = (tree: Array<Directory | File>): File[] =>
  tree.flatMap((item) =>
    isDirectory(item)
      ? listOpenableDocuments(item.children ?? [])
      : inferArtifactTypeFromExtension(item.path) ===
          versionedArtifactTypes.RICH_TEXT_DOCUMENT
        ? [item]
        : []
  );
