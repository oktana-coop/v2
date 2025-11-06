import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, { type PromiseFsClient as NodeLikeFsApi } from 'isomorphic-git';

import {
  type ChangeId,
  decomposeGitBlobRef,
  type GitBlobRef,
  type GitCommitHash,
  isGitBlobRef,
  parseGitCommitHash,
  type ResolvedArtifactId,
  UNCOMMITTED_CHANGE_ID,
  versionedArtifactTypes,
} from '../../../../../modules/infrastructure/version-control';
import { fromNullable } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import { NotFoundError, RepositoryError, ValidationError } from '../../errors';
import { CURRENT_SCHEMA_VERSION, type ResolvedDocument } from '../../models';
import { type VersionedDocumentStore } from '../../ports/versioned-document-store';
import { isNodeError } from './utils';

export const createAdapter = ({
  fs,
  projId,
}: {
  fs: NodeLikeFsApi;
  projId?: string;
}): VersionedDocumentStore => {
  // This is not an ideal model but we want to be able to tell that the document store we are searching in is the desired one.
  // Without this we are risking registering interest in documents from other repositories (and therefore polluting our stores)
  let projectId: string | null = projId ?? null;
  const setProjectId: VersionedDocumentStore['setProjectId'] = (id) =>
    Effect.sync(() => {
      projectId = id;
    });

  const getProjectDir = (): Effect.Effect<string, RepositoryError, never> =>
    fromNullable(
      projectId,
      () => new RepositoryError('Project ID not set in the document repo')
    );

  const validateDocumentId: (
    id: ResolvedArtifactId
  ) => Effect.Effect<GitBlobRef, ValidationError, never> = (id) =>
    pipe(
      Effect.succeed(id),
      Effect.filterOrFail(
        isGitBlobRef,
        (val) => new ValidationError(`Invalid document id: ${val}`)
      )
    );

  const extractDocumentPathFromId: (
    id: ResolvedArtifactId
  ) => Effect.Effect<string, ValidationError, never> = (id) =>
    pipe(
      validateDocumentId(id),
      Effect.map((gitBlobRef) => {
        const { path: documentPath } = decomposeGitBlobRef(gitBlobRef);
        return documentPath;
      })
    );

  const createDocument: VersionedDocumentStore['createDocument'] = ({ id }) =>
    pipe(
      fromNullable(
        id,
        () =>
          new ValidationError(
            'Id is required when creating a document in the Git repo'
          )
      ),
      Effect.flatMap(validateDocumentId)
    );

  const findDocumentById: VersionedDocumentStore['findDocumentById'] = (id) =>
    pipe(
      extractDocumentPathFromId(id),
      // Unfortunately, due to the fact that we are not using our FileSystem port
      // (isomorphic-git comes with its own API), we are repeating file-reading logic here.
      Effect.flatMap((documentPath) =>
        Effect.tryPromise({
          try: async () => {
            const fileContent = await fs.promises.readFile(
              documentPath,
              'utf8'
            );

            if (typeof fileContent !== 'string') {
              throw new RepositoryError('Expected text file content');
            }

            return fileContent;
          },
          catch: (err) => {
            if (isNodeError(err)) {
              switch (err.code) {
                case 'ENOENT':
                  return new NotFoundError(
                    `File in path ${documentPath} does not exist`
                  );
                default:
                  return new RepositoryError(err.message);
              }
            }

            return new RepositoryError(
              `Error reading file with path ${documentPath}`
            );
          },
        })
      ),
      Effect.map(
        (content) =>
          ({
            id,
            artifact: {
              type: versionedArtifactTypes.RICH_TEXT_DOCUMENT,
              schemaVersion: CURRENT_SCHEMA_VERSION,
              representation: 'AUTOMERGE',
              content,
            },
            handle: null,
          }) as ResolvedDocument
      )
    );

  const getDocumentLastChangeId: VersionedDocumentStore['getDocumentLastChangeId'] =
    (documentId) => {
      const isDocumentModified: (args: {
        projectDir: string;
        documentPath: string;
      }) => Effect.Effect<boolean, RepositoryError | NotFoundError, never> = ({
        projectDir,
        documentPath,
      }) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              git.status({
                fs,
                dir: projectDir,
                filepath: documentPath,
              }),
            catch: mapErrorTo(RepositoryError, 'Git repo error'),
          }),
          Effect.flatMap((fileChangedStatus) => {
            if (
              fileChangedStatus === 'ignored' ||
              fileChangedStatus === 'absent'
            ) {
              return Effect.fail(
                new NotFoundError('Document is ignored or absent')
              );
            }

            if (fileChangedStatus === 'unmodified') {
              return Effect.succeed(false);
            }

            return Effect.succeed(true);
          })
        );

      const getLastModificationCommitId: (args: {
        projectDir: string;
        documentPath: string;
      }) => Effect.Effect<GitCommitHash, RepositoryError, never> = ({
        projectDir,
        documentPath,
      }) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              git.log({
                fs,
                dir: projectDir,
                // get only the latest commit affecting the file
                depth: 1,
                filepath: documentPath,
              }),
            catch: mapErrorTo(RepositoryError, 'Git repo error'),
          }),
          Effect.flatMap((commits) =>
            commits.length > 0
              ? Effect.try({
                  try: () => parseGitCommitHash(commits[0].oid),
                  catch: mapErrorTo(RepositoryError, 'Git repo error'),
                })
              : Effect.fail(
                  // TODO: Consider returning a NotFoundError
                  // But since we know there is some kind of modification, we must get a commit that modified the document.
                  new RepositoryError(
                    'Could not find the last commit that modified the document'
                  )
                )
          )
        );

      const getChangeId: (
        modified: boolean
      ) => (args: {
        projectDir: string;
        documentPath: string;
      }) => Effect.Effect<ChangeId, RepositoryError, never> =
        (modified) =>
        ({ projectDir, documentPath }) =>
          modified
            ? Effect.succeed(UNCOMMITTED_CHANGE_ID)
            : getLastModificationCommitId({ documentPath, projectDir });

      return Effect.Do.pipe(
        Effect.bind('documentPath', () =>
          extractDocumentPathFromId(documentId)
        ),
        Effect.bind('projectDir', () => getProjectDir()),
        Effect.flatMap(({ documentPath, projectDir }) =>
          pipe(
            isDocumentModified({ projectDir, documentPath }),
            Effect.flatMap((modified) =>
              getChangeId(modified)({ projectDir, documentPath })
            )
          )
        )
      );
    };

  // This is a no-op in the Git repo since we don't need to explicitly tell Git to track changes to a document in the project repo
  const updateRichTextDocumentContent: VersionedDocumentStore['updateRichTextDocumentContent'] =
    () => Effect.succeed(undefined);

  // This is a no-op in the Git document repo since the relevant operation in the project repo (deleting a document from a project) does it.
  const deleteDocument: VersionedDocumentStore['deleteDocument'] = () =>
    Effect.succeed(undefined);

  const commitChanges: VersionedDocumentStore['commitChanges'] = ({
    documentId,
    message,
  }) =>
    Effect.Do.pipe(
      Effect.bind('documentPath', () => extractDocumentPathFromId(documentId)),
      Effect.bind('projectDir', () => getProjectDir()),
      Effect.flatMap(({ documentPath, projectDir }) =>
        pipe(
          Effect.tryPromise({
            try: () => git.add({ fs, dir: projectDir, filepath: documentPath }),
            catch: mapErrorTo(RepositoryError, 'Git repo error'),
          }),
          Effect.flatMap(() =>
            Effect.tryPromise({
              try: () =>
                git.commit({
                  fs,
                  dir: projectDir,
                  message,
                }),
              catch: mapErrorTo(RepositoryError, 'Git repo error'),
            })
          )
        )
      )
    );

  return {
    projectId,
    setProjectId,
    createDocument,
    findDocumentById,
    getDocumentLastChangeId,
    updateRichTextDocumentContent,
    deleteDocument,
    commitChanges,
    getDocumentHistory,
    getDocumentAtChange,
    isContentSameAtHeads,
    exportDocumentToBinary,
    importDocumentFromBinary,
    disconnect,
  };
};
