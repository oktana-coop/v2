import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import git, { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  type Filesystem,
  removePath,
} from '../../../../../../../modules/infrastructure/filesystem';
import {
  createGitBlobRef,
  DEFAULT_AUTHOR_NAME,
  DEFAULT_BRANCH,
  isGitBlobRef,
  parseBranch,
  type ResolvedArtifactId,
  versionedArtifactTypes,
} from '../../../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../../../utils/errors';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../../errors';
import {
  type ArtifactMetaData,
  CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION,
  isProjectFsPath,
  parseProjectFsPath,
  type ProjectId,
} from '../../../../models';
import { MultiDocumentProjectStore } from '../../../../ports/multi-document-project';

export const createAdapter = ({
  isoGitFs,
  filesystem,
}: {
  // We have 2 filesystem APIs because isomorphic-git works well in both browser in Node.js
  // with its own implemented fs APIs, which more or less comply to the Node.js API.
  // In cases where we interact with the filesystem outside isomorphic-git (e.g. for listing files or normailizing paths),
  // we are using our own Filesystem API.
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
}): MultiDocumentProjectStore => {
  const createProject: MultiDocumentProjectStore['createProject'] = ({
    path,
  }) =>
    pipe(
      Effect.try({
        try: () => parseProjectFsPath(path),
        catch: mapErrorTo(ValidationError, 'Invalid project path'),
      }),
      Effect.tap((projectPath) =>
        Effect.tryPromise({
          try: () =>
            git.init({
              fs: isoGitFs,
              dir: projectPath,
              defaultBranch: DEFAULT_BRANCH,
            }),
          catch: mapErrorTo(RepositoryError, 'Git repo error'),
        })
      )
    );

  const getDirectoryFiles = (id: ProjectId) =>
    pipe(
      Effect.succeed(id),
      Effect.filterOrFail(
        isProjectFsPath,
        (val) => new ValidationError(`Invalid project id: ${val}`)
      ),
      Effect.flatMap((projectPath) =>
        pipe(
          filesystem.listDirectoryFiles({
            path: projectPath,
            useRelativePath: true,
          }),
          Effect.catchAll(() =>
            Effect.fail(new RepositoryError('Git repo error'))
          )
        )
      )
    );

  const findProjectById: MultiDocumentProjectStore['findProjectById'] = (id) =>
    Effect.Do.pipe(
      Effect.bind('files', () => getDirectoryFiles(id)),
      Effect.bind('currentBranch', () => getCurrentBranch({ projectId: id })),
      Effect.map(({ files, currentBranch }) =>
        files.reduce<Record<ResolvedArtifactId, ArtifactMetaData>>(
          (acc, file) => {
            // TODO: Handle errors returned by createGitBlobRef
            const documentId = createGitBlobRef({
              ref: currentBranch,
              path: file.path,
            });

            acc[documentId] = {
              id: documentId,
              name: file.name,
              path: file.path,
            };

            return acc;
          },
          {}
        )
      ),
      Effect.map((documents) => ({
        type: versionedArtifactTypes.MULTI_DOCUMENT_PROJECT,
        schemaVersion: CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION,
        path: id,
        documents,
      }))
    );

  const listProjectDocuments: MultiDocumentProjectStore['listProjectDocuments'] =
    (id) =>
      pipe(
        findProjectById(id),
        Effect.map((project) => Object.values(project.documents))
      );

  // This is a no-op in the Git repo.
  // The new doc will be committed when we commit the first set of changes to it.
  const addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'] =
    () => Effect.succeed(undefined);

  const deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'] =
    ({ projectId, documentId }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () =>
          pipe(
            Effect.succeed(projectId),
            Effect.filterOrFail(
              isProjectFsPath,
              (val) => new ValidationError(`Invalid project id: ${val}`)
            )
          )
        ),
        Effect.bind('documentName', () =>
          pipe(
            Effect.succeed(documentId),
            Effect.filterOrFail(
              isGitBlobRef,
              (val) => new ValidationError(`Invalid document id: ${val}`)
            ),
            // TODO: This won't work well for documents inside sub-folders.
            Effect.map((documentGitBlobRef) => removePath(documentGitBlobRef))
          )
        ),
        Effect.flatMap(({ projectPath, documentName }) =>
          pipe(
            Effect.tryPromise({
              try: () =>
                git.remove({
                  fs: isoGitFs,
                  dir: projectPath,
                  filepath: documentName,
                }),
              catch: mapErrorTo(RepositoryError, 'Git repo error'),
            }),
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: () =>
                  git.commit({
                    fs: isoGitFs,
                    dir: projectPath,
                    author: {
                      name: DEFAULT_AUTHOR_NAME,
                    },
                    message: `Removed ${documentName}`,
                  }),
                catch: mapErrorTo(RepositoryError, 'Git repo error'),
              })
            )
          )
        )
      );

  const findDocumentInProject: MultiDocumentProjectStore['findDocumentInProject'] =
    ({ projectId, documentPath }) =>
      pipe(
        listProjectDocuments(projectId),
        Effect.flatMap((projectDocuments) =>
          pipe(
            Option.fromNullable(
              projectDocuments.find(
                (documentMetaData) => documentMetaData.path === documentPath
              )
            ),
            Option.match({
              onNone: () =>
                Effect.fail(
                  new NotFoundError(
                    `Document with path ${documentPath} not found in project`
                  )
                ),
              onSome: (documentMetaData) => Effect.succeed(documentMetaData.id),
            })
          )
        )
      );

  const createAndSwitchToBranch: MultiDocumentProjectStore['createAndSwitchToBranch'] =
    ({ projectId, branch }) =>
      pipe(
        Effect.succeed(projectId),
        Effect.filterOrFail(
          isProjectFsPath,
          (val) => new ValidationError(`Invalid project id: ${val}`)
        ),
        Effect.flatMap((projectPath) =>
          Effect.tryPromise({
            try: () =>
              git.branch({
                fs: isoGitFs,
                dir: projectPath,
                ref: branch,
                checkout: true,
              }),
            catch: mapErrorTo(RepositoryError, 'Git repo error'),
          })
        )
      );

  const switchToBranch: MultiDocumentProjectStore['switchToBranch'] = ({
    projectId,
    branch,
  }) =>
    pipe(
      Effect.succeed(projectId),
      Effect.filterOrFail(
        isProjectFsPath,
        (val) => new ValidationError(`Invalid project id: ${val}`)
      ),
      Effect.flatMap((projectPath) =>
        Effect.tryPromise({
          try: () =>
            git.checkout({
              fs: isoGitFs,
              dir: projectPath,
              ref: branch,
            }),
          catch: mapErrorTo(RepositoryError, 'Git repo error'),
        })
      )
    );

  const getCurrentBranch: MultiDocumentProjectStore['getCurrentBranch'] = ({
    projectId,
  }) =>
    pipe(
      Effect.succeed(projectId),
      Effect.filterOrFail(
        isProjectFsPath,
        (val) => new ValidationError(`Invalid project id: ${val}`)
      ),
      Effect.flatMap((projectPath) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              git.currentBranch({
                fs: isoGitFs,
                dir: projectPath,
              }),
            catch: mapErrorTo(RepositoryError, 'Git repo error'),
          }),
          Effect.filterOrFail(
            (currentBranch) => typeof currentBranch === 'string',
            () =>
              new NotFoundError(
                'Could not retrieve the current branch. The repo is in detached HEAD state.'
              )
          ),
          Effect.flatMap((currentBranch) =>
            Effect.try({
              try: () => parseBranch(currentBranch),
              catch: mapErrorTo(RepositoryError, 'Git repo error'),
            })
          )
        )
      )
    );

  const listBranches: MultiDocumentProjectStore['listBranches'] = ({
    projectId,
  }) =>
    pipe(
      Effect.succeed(projectId),
      Effect.filterOrFail(
        isProjectFsPath,
        (val) => new ValidationError(`Invalid project id: ${val}`)
      ),
      Effect.flatMap((projectPath) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              git.listBranches({
                fs: isoGitFs,
                dir: projectPath,
              }),
            catch: mapErrorTo(RepositoryError, 'Error when listing branches'),
          }),
          Effect.flatMap((branches) =>
            Effect.forEach(branches, (branch) =>
              Effect.try({
                try: () => parseBranch(branch),
                catch: mapErrorTo(
                  RepositoryError,
                  `Could not parse branch ${branch}`
                ),
              })
            )
          )
        )
      )
    );

  return {
    createProject,
    findProjectById,
    listProjectDocuments,
    addDocumentToProject,
    deleteDocumentFromProject,
    findDocumentInProject,
    createAndSwitchToBranch,
    switchToBranch,
    getCurrentBranch,
    listBranches,
  };
};
