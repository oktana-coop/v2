import {
  type FilesystemItemType,
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

export type ArtifactTreeNode = ArtifactMetaData & {
  filesystemType: FilesystemItemType;
  children?: ArtifactTreeNode[];
};

// The artifact's file name, as it exists on disk.
export const getArtifactNameWithExtension = (path: ProjectRelPath): string =>
  removePath(path);

// The artifact's name as the editor presents it — the file name without its
// extension, since the extension is an implementation detail of the format.
export const getArtifactName = (path: ProjectRelPath): string =>
  removeExtension(removePath(path));

// Flattens a node tree into a depth-first list of all its nodes.
const flattenTree = (tree: ArtifactTreeNode[]): ArtifactTreeNode[] =>
  tree.flatMap((node) => [node, ...flattenTree(node.children ?? [])]);

// Locates a tree node by its project-relative path.
export const findNodeByPath = ({
  tree,
  path,
}: {
  tree: ArtifactTreeNode[];
  path: ProjectRelPath;
}): ArtifactTreeNode | null =>
  flattenTree(tree).find((node) => node.path === path) ?? null;

// Filters a project artifact tree to the nodes the editor can open, descending
// into subdirectories and dropping directories and assets with unsupported
// extensions.
export const listOpenableArtifacts = (
  tree: ArtifactTreeNode[]
): ArtifactTreeNode[] =>
  tree.flatMap((node) =>
    node.filesystemType === filesystemItemTypes.DIRECTORY
      ? listOpenableArtifacts(node.children ?? [])
      : node.kind === artifactKinds.RICH_TEXT_DOCUMENT
        ? [node]
        : []
  );
