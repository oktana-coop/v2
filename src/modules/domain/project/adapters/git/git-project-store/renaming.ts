import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  commitStagedChanges as commitStagedChangesInGit,
  renameFile as renameFileInGit,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { RepositoryError } from '../../../errors';
import { type ProjectStore } from '../../../ports';
import { ensureProjectIdIsFsPath } from './project-id';

type RenamingOps = Pick<
  ProjectStore,
  'renameDocumentInProject' | 'renameDocumentsInProject'
>;

export const createRenamingOps = ({
  isoGitFs,
}: {
  isoGitFs: IsoGitFsApi;
}): RenamingOps => {
  const renameDocumentInProject: RenamingOps['renameDocumentInProject'] = ({
    projectId,
    oldDocumentPath,
    newDocumentPath,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          renameFileInGit({
            isoGitFs,
            dir: projectPath,
            oldPath: oldDocumentPath,
            newPath: newDocumentPath,
          }),
          Effect.flatMap(() =>
            commitStagedChangesInGit({
              isoGitFs,
              dir: projectPath,
              message: `Renamed ${oldDocumentPath} to ${newDocumentPath}`,
            })
          ),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const renameDocumentsInProject: RenamingOps['renameDocumentsInProject'] = ({
    projectId,
    documentRenames,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          Effect.forEach(
            documentRenames,
            ({ oldDocumentPath, newDocumentPath }) =>
              renameFileInGit({
                isoGitFs,
                dir: projectPath,
                oldPath: oldDocumentPath,
                newPath: newDocumentPath,
              })
          ),
          Effect.flatMap(() =>
            commitStagedChangesInGit({
              isoGitFs,
              dir: projectPath,
              message:
                documentRenames.length === 1
                  ? `Renamed ${documentRenames[0].oldDocumentPath} to ${documentRenames[0].newDocumentPath}`
                  : `Renamed ${documentRenames.length} documents`,
            })
          ),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          ),
          Effect.asVoid
        )
      )
    );

  return { renameDocumentInProject, renameDocumentsInProject };
};
