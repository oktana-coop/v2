import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type Branch } from '../../../../modules/infrastructure/version-control';
import {
  isProjectDirectoryNode,
  type ProjectId,
  type ProjectStoreFileNode,
  type ProjectStoreTreeNode,
  type ProjectTreeNode,
} from '../models';
import { type ProjectStore, type ShareRegistry } from '../ports';

export type GetProjectTreeDeps = {
  getProjectStoreTree: ProjectStore['getProjectTree'];
  isShared: ShareRegistry['isShared'];
};

export type GetProjectTreeArgs = {
  projectId: ProjectId;
  // With no branch known yet, nothing is marked as shared.
  branch: Branch | null;
};

// The store's tree with each document marked as shared or not.
export const markSharedDocuments = ({
  tree,
  isShared,
}: {
  tree: ProjectStoreTreeNode[];
  isShared: (node: ProjectStoreFileNode) => boolean;
}): ProjectTreeNode[] =>
  tree.map((node) =>
    isProjectDirectoryNode(node)
      ? {
          ...node,
          children: markSharedDocuments({ tree: node.children, isShared }),
        }
      : { ...node, shared: isShared(node) }
  );

// The project tree as the app works with it: what the store lists, marked
// with the shares this client takes part in on the branch.
export const getProjectTree =
  ({ getProjectStoreTree, isShared }: GetProjectTreeDeps) =>
  ({ projectId, branch }: GetProjectTreeArgs) =>
    pipe(
      getProjectStoreTree(projectId),
      Effect.map((tree) =>
        markSharedDocuments({
          tree,
          isShared: (node) =>
            branch !== null &&
            isShared({ projectId, branch, documentId: node.id }),
        })
      )
    );
