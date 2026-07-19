import {
  filesystemItemTypes,
  getExtension,
  removeExtension,
  removePath,
} from '../../../infrastructure/filesystem';
import { type ArtifactId } from '../../../infrastructure/version-control';
import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  richTextRepresentationExtensions,
} from '../../rich-text';
import { type ArtifactKind, artifactKinds } from './artifact-kind';
import { type ProjectRelPath } from './project-rel-path';

const DOCUMENT_EXTENSION =
  richTextRepresentationExtensions[
    PRIMARY_RICH_TEXT_REPRESENTATION
  ].toLowerCase();

// Classifies a file path by its extension: the primary rich-text
// representation is a document, anything else is an asset.
export const inferArtifactKindFromExtension = (path: string): ArtifactKind =>
  getExtension(path).toLowerCase() === DOCUMENT_EXTENSION
    ? artifactKinds.RICH_TEXT_DOCUMENT
    : artifactKinds.ASSET;

export type BaseArtifactMetaData = {
  id: ArtifactId;
};

export type ArtifactMetaData = BaseArtifactMetaData & {
  path: ProjectRelPath;
  kind: ArtifactKind;
};

// An artifact known to be one kind or the other, so consumers holding a
// collection of documents don't have to re-check what they already know.
export type DocumentMetaData = ArtifactMetaData & {
  kind: typeof artifactKinds.RICH_TEXT_DOCUMENT;
};

export type AssetMetaData = ArtifactMetaData & {
  kind: typeof artifactKinds.ASSET;
};

export const isDocumentMetaData = (
  artifact: ArtifactMetaData
): artifact is DocumentMetaData =>
  artifact.kind === artifactKinds.RICH_TEXT_DOCUMENT;

export const isAssetMetaData = (
  artifact: ArtifactMetaData
): artifact is AssetMetaData => artifact.kind === artifactKinds.ASSET;

// A file in the project tree. Version control tracks these, so a file has an
// artifact identity of its own.
export type ProjectFileNode = ArtifactMetaData & {
  filesystemType: typeof filesystemItemTypes.FILE;
};

// A directory is structure derived from the paths of the files under it, not
// something version control tracks. A directory node carries a path and its
// contents, but no artifact id or kind.
export type ProjectDirectoryNode = {
  path: ProjectRelPath;
  filesystemType: typeof filesystemItemTypes.DIRECTORY;
  children: ProjectTreeNode[];
};

export type ProjectTreeNode = ProjectFileNode | ProjectDirectoryNode;

export const isProjectFileNode = (
  node: ProjectTreeNode
): node is ProjectFileNode => node.filesystemType === filesystemItemTypes.FILE;

export const isProjectDirectoryNode = (
  node: ProjectTreeNode
): node is ProjectDirectoryNode =>
  node.filesystemType === filesystemItemTypes.DIRECTORY;

// The artifact's name as the editor presents it — the file name without its
// extension, since the extension is an implementation detail of the format.
export const getArtifactName = (path: ProjectRelPath): string =>
  removeExtension(removePath(path));

// Flattens a node tree into a depth-first list of all its nodes.
const flattenTree = (tree: ProjectTreeNode[]): ProjectTreeNode[] =>
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
  tree: ProjectTreeNode[];
  path: ProjectRelPath;
}): ProjectFileNode | null =>
  flattenTree(tree)
    .filter(isProjectFileNode)
    .find((node) => node.path === path) ?? null;

// Locates a file node by its artifact id.
export const findNodeById = ({
  tree,
  id,
}: {
  tree: ProjectTreeNode[];
  id: ArtifactId;
}): ProjectFileNode | null =>
  flattenTree(tree)
    .filter(isProjectFileNode)
    .find((node) => node.id === id) ?? null;

// Filters a project tree to the files the editor can open, descending into
// subdirectories and dropping assets with unsupported extensions.
export const listOpenableArtifacts = (
  tree: ProjectTreeNode[]
): ProjectFileNode[] =>
  tree.flatMap((node) =>
    isProjectDirectoryNode(node)
      ? listOpenableArtifacts(node.children)
      : node.kind === artifactKinds.RICH_TEXT_DOCUMENT
        ? [node]
        : []
  );
