import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import git, { type PromiseFsClient as NodeLikeFsApi } from 'isomorphic-git';

import { removePath } from '../../../../../../modules/infrastructure/filesystem';
import {
  createGitBlobRef,
  DEFAULT_AUTHOR_NAME,
  DEFAULT_BRANCH,
  isGitBlobRef,
  type ResolvedArtifactId,
  versionedArtifactTypes,
} from '../../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../../utils/errors';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../errors';
import {
  type ArtifactMetaData,
  CURRENT_MULTI_DOCUMENT_PROJECT_SCHEMA_VERSION,
  isProjectDirPath,
  parseProjectDirPath,
} from '../../../models';
import { MultiDocumentProjectStore } from '../../../ports/multi-document-project';

export const createAdapter = ({
  fs,
}: {
  fs: NodeLikeFsApi;
}): MultiDocumentProjectStore => {
  const createProject: MultiDocumentProjectStore['createProject'] = ({
    path,
  }) =>
    pipe(
      Effect.try({
        try: () => parseProjectDirPath(path),
        catch: mapErrorTo(ValidationError, 'Invalid project path'),
      }),
      Effect.tap((projectPath) =>
        Effect.try({
          try: () =>
            git.init({ fs, dir: projectPath, defaultBranch: DEFAULT_BRANCH }),
          catch: mapErrorTo(RepositoryError, 'Git repo error'),
        })
      )
    );

  const findProjectById: MultiDocumentProjectStore['findProjectById'] = (id) =>
    pipe(
      Effect.succeed(id),
      Effect.filterOrFail(
        isProjectDirPath,
        (val) => new ValidationError(`Invalid project id: ${val}`)
      ),
      Effect.flatMap((projectPath) =>
        Effect.tryPromise({
          // Note: This lists files in Git's staging area.
          try: () => git.listFiles({ fs, dir: projectPath }),
          catch: mapErrorTo(RepositoryError, 'Git repo error'),
        })
      ),
      Effect.map((files) =>
        files.reduce<Record<ResolvedArtifactId, ArtifactMetaData>>(
          (acc, path) => {
            // TODO: Make branch a param
            // TODO: Handle errors returned by createGitBlobRef
            const documentId = createGitBlobRef({ ref: DEFAULT_BRANCH, path });

            acc[documentId] = {
              id: documentId,
              name: removePath(path),
              path,
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

  const addDocumentToProject: MultiDocumentProjectStore['addDocumentToProject'] =
    ({ documentId, projectId }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () =>
          pipe(
            Effect.succeed(projectId),
            Effect.filterOrFail(
              isProjectDirPath,
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
                git.add({ fs, dir: projectPath, filepath: documentName }),
              catch: mapErrorTo(RepositoryError, 'Git repo error'),
            }),
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: () =>
                  git.commit({
                    fs,
                    dir: projectPath,
                    author: {
                      name: DEFAULT_AUTHOR_NAME,
                    },
                    message: `Added ${documentName}`,
                  }),
                catch: mapErrorTo(RepositoryError, 'Git repo error'),
              })
            )
          )
        )
      );

  const deleteDocumentFromProject: MultiDocumentProjectStore['deleteDocumentFromProject'] =
    ({ projectId, documentId }) =>
      Effect.Do.pipe(
        Effect.bind('projectPath', () =>
          pipe(
            Effect.succeed(projectId),
            Effect.filterOrFail(
              isProjectDirPath,
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
                git.remove({ fs, dir: projectPath, filepath: documentName }),
              catch: mapErrorTo(RepositoryError, 'Git repo error'),
            }),
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: () =>
                  git.commit({
                    fs,
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
                Effect.fail(new NotFoundError('Document not found in project')),
              onSome: (documentMetaData) => Effect.succeed(documentMetaData.id),
            })
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
  };
};
