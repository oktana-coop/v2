import {
  type FilesystemItemType,
  filesystemItemTypes,
} from '../../../infrastructure/filesystem';
import {
  type ArtifactId,
  versionedArtifactTypes,
} from '../../../infrastructure/version-control';
import { inferArtifactTypeFromExtension } from './document-asset-paths';
import { type ProjectRelPath } from './project-rel-path';

export type BaseArtifactMetaData = {
  id: ArtifactId;
};

export type ArtifactMetaData = BaseArtifactMetaData & {
  name: string;
  path: ProjectRelPath;
};

export type ArtifactTreeNode = ArtifactMetaData & {
  type: FilesystemItemType;
  children?: ArtifactTreeNode[];
};

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
    node.type === filesystemItemTypes.DIRECTORY
      ? listOpenableArtifacts(node.children ?? [])
      : inferArtifactTypeFromExtension(node.path) ===
          versionedArtifactTypes.RICH_TEXT_DOCUMENT
        ? [node]
        : []
  );
