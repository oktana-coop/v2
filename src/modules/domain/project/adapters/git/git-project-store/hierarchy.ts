import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  PRIMARY_RICH_TEXT_REPRESENTATION,
  richTextRepresentationExtensions,
} from '../../../../../../modules/domain/rich-text';
import {
  type Directory,
  type File,
  type Filesystem,
  isDirectory,
} from '../../../../../../modules/infrastructure/filesystem';
import {
  createGitBlobRef,
  createGitTreeRef,
} from '../../../../../../modules/infrastructure/version-control';
import { RepositoryError, ValidationError } from '../../../errors';
import {
  type ArtifactTreeNode,
  inferArtifactKindFromExtension,
  parseProjectRelPathEffect,
} from '../../../models';
import { type ProjectStore } from '../../../ports';
import { getCurrentBranch } from './branching';
import { ensureProjectIdIsFsPath } from './project-id';

type HierarchyOps = Pick<ProjectStore, 'getProjectTree'>;

const toArtifactTreeNode =
  (ref: string) =>
  (node: Directory | File): Effect.Effect<ArtifactTreeNode, ValidationError> =>
    pipe(
      parseProjectRelPathEffect(node.path),
      Effect.flatMap(
        (path): Effect.Effect<ArtifactTreeNode, ValidationError> =>
          isDirectory(node)
            ? pipe(
                Effect.forEach(node.children ?? [], toArtifactTreeNode(ref)),
                Effect.map((children) => ({
                  id: createGitTreeRef({ ref, path }),
                  path,
                  kind: inferArtifactKindFromExtension(path),
                  filesystemType: node.type,
                  children,
                }))
              )
            : Effect.succeed({
                id: createGitBlobRef({ ref, path }),
                path,
                kind: inferArtifactKindFromExtension(path),
                filesystemType: node.type,
              })
      )
    );

export const createHierarchyOps = ({
  isoGitFs,
  filesystem,
}: {
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
}): HierarchyOps => {
  const getProjectTree: HierarchyOps['getProjectTree'] = (id) =>
    pipe(
      ensureProjectIdIsFsPath(id),
      Effect.flatMap((projectDir) =>
        Effect.all(
          {
            currentBranch: getCurrentBranch({ isoGitFs, projectDir }),
            tree: pipe(
              filesystem.listDirectoryTree({
                path: projectDir,
                extensions: [
                  richTextRepresentationExtensions[
                    PRIMARY_RICH_TEXT_REPRESENTATION
                  ],
                ],
                useRelativePathTo: projectDir,
              }),
              Effect.catchAll(() =>
                Effect.fail(new RepositoryError('Git repo error'))
              )
            ),
          },
          { concurrency: 'unbounded' }
        )
      ),
      Effect.flatMap(({ tree, currentBranch }) =>
        Effect.forEach(tree, toArtifactTreeNode(currentBranch))
      )
    );

  return { getProjectTree };
};
