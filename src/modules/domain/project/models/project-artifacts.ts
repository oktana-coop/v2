import {
  filesystemEntryTypes,
  getExtension,
  removePath,
} from '../../../infrastructure/filesystem';
import { type ArtifactId } from '../../../infrastructure/version-control';
import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  richTextRepresentationExtensions,
} from '../../rich-text';
import { BINARY_FILE_EXTENSIONS } from '../constants';
import { type ArtifactKind, artifactKinds } from './artifact-kind';
import { type ProjectRelPath } from './project-rel-path';

const RICH_TEXT_DOCUMENT_EXTENSIONS = new Set(
  richTextRepresentationExtensions[PRIMARY_RICH_TEXT_REPRESENTATION].map(
    (extension) => extension.toLowerCase()
  )
);

const BINARY_FILE_EXTENSION_SET = new Set(
  BINARY_FILE_EXTENSIONS.map((extension) => extension.toLowerCase())
);

export const inferArtifactKindFromExtension = (path: string): ArtifactKind => {
  const extension = getExtension(path).toLowerCase();

  if (RICH_TEXT_DOCUMENT_EXTENSIONS.has(extension)) {
    return artifactKinds.RICH_TEXT_DOCUMENT;
  }

  if (BINARY_FILE_EXTENSION_SET.has(extension)) {
    return artifactKinds.BINARY_FILE;
  }

  return artifactKinds.PLAIN_TEXT_DOCUMENT;
};

export type BaseArtifactMetaData = {
  id: ArtifactId;
};

export type ArtifactMetaData = BaseArtifactMetaData & {
  path: ProjectRelPath;
  kind: ArtifactKind;
};

// An artifact known to be a rich-text document, so consumers holding a
// collection of documents don't have to re-check what they already know.
export type RichTextDocumentMetaData = ArtifactMetaData & {
  kind: typeof artifactKinds.RICH_TEXT_DOCUMENT;
};

export const isRichTextDocumentMetaData = (
  artifact: ArtifactMetaData
): artifact is RichTextDocumentMetaData =>
  artifact.kind === artifactKinds.RICH_TEXT_DOCUMENT;

// A file as the project store lists it. Version control tracks these, so a
// file has an artifact identity of its own.
export type ProjectStoreFileNode = ArtifactMetaData & {
  filesystemType: typeof filesystemEntryTypes.FILE;
};

// A directory is structure derived from the paths of the files under it, not
// something version control tracks. A directory node carries a path and its
// contents, but no artifact id or kind.
export type ProjectStoreDirectoryNode = {
  path: ProjectRelPath;
  filesystemType: typeof filesystemEntryTypes.DIRECTORY;
  children: ProjectStoreTreeNode[];
};

export type ProjectStoreTreeNode =
  ProjectStoreFileNode | ProjectStoreDirectoryNode;

export type ProjectFileNode = ProjectStoreFileNode & { shared: boolean };

export type ProjectDirectoryNode = Omit<
  ProjectStoreDirectoryNode,
  'children'
> & { children: ProjectTreeNode[] };

export type ProjectTreeNode = ProjectFileNode | ProjectDirectoryNode;

export const isProjectFileNode = (
  node: ProjectStoreTreeNode
): node is ProjectStoreFileNode =>
  node.filesystemType === filesystemEntryTypes.FILE;

export const isProjectDirectoryNode = (
  node: ProjectStoreTreeNode
): node is ProjectStoreDirectoryNode =>
  node.filesystemType === filesystemEntryTypes.DIRECTORY;

// The artifact's name as the editor presents it: the file name, extension
// included, since the extension decides how the file opens.
export const getArtifactName = (path: ProjectRelPath): string =>
  removePath(path);

const areProjectTreeNodesEqual = (
  a: ProjectTreeNode,
  b: ProjectTreeNode
): boolean =>
  isProjectDirectoryNode(a)
    ? isProjectDirectoryNode(b) &&
      a.path === b.path &&
      areProjectTreesEqual(a.children, b.children)
    : isProjectFileNode(b) &&
      a.id === b.id &&
      a.path === b.path &&
      a.kind === b.kind &&
      a.shared === b.shared;

export const areProjectTreesEqual = (
  a: ProjectTreeNode[],
  b: ProjectTreeNode[]
): boolean =>
  a.length === b.length &&
  a.every((node, index) => areProjectTreeNodesEqual(node, b[index]));

// Flattens a node tree into a depth-first list of all its nodes.
const flattenTree = (tree: ProjectStoreTreeNode[]): ProjectStoreTreeNode[] =>
  tree.flatMap((node) =>
    isProjectDirectoryNode(node)
      ? [node, ...flattenTree(node.children)]
      : [node]
  );

// Locates a file node by its project-relative path. Directories are skipped:
// they have no artifact identity, so there is nothing for a caller to act on.
export const findFileNodeByPath = ({
  tree,
  path,
}: {
  tree: ProjectStoreTreeNode[];
  path: ProjectRelPath;
}): ProjectStoreFileNode | null =>
  flattenTree(tree)
    .filter(isProjectFileNode)
    .find((node) => node.path === path) ?? null;

// Locates a directory node by its project-relative path.
const findDirectoryNodeByPath = ({
  tree,
  path,
}: {
  tree: ProjectStoreTreeNode[];
  path: ProjectRelPath;
}): ProjectStoreDirectoryNode | null =>
  flattenTree(tree)
    .filter(isProjectDirectoryNode)
    .find((node) => node.path === path) ?? null;

// The names of the files and directories directly inside a directory, or
// inside the project root when no directory is given.
export const listNamesInDirectory = ({
  tree,
  directoryPath,
}: {
  tree: ProjectStoreTreeNode[];
  directoryPath?: ProjectRelPath;
}): string[] => {
  const entries = directoryPath
    ? (findDirectoryNodeByPath({ tree, path: directoryPath })?.children ?? [])
    : tree;

  return entries.map((node) => removePath(node.path));
};

// Locates a file node by its artifact id.
export const findNodeById = ({
  tree,
  id,
}: {
  tree: ProjectStoreTreeNode[];
  id: ArtifactId;
}): ProjectStoreFileNode | null =>
  flattenTree(tree)
    .filter(isProjectFileNode)
    .find((node) => node.id === id) ?? null;

// Filters a project tree to the files the editor can open, descending into
// subdirectories: rich-text documents, for now.
export const listOpenableArtifacts = (
  tree: ProjectStoreTreeNode[]
): ProjectStoreFileNode[] =>
  tree.flatMap((node) =>
    isProjectDirectoryNode(node)
      ? listOpenableArtifacts(node.children)
      : node.kind === artifactKinds.RICH_TEXT_DOCUMENT
        ? [node]
        : []
  );
