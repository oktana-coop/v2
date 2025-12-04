import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import { type Filesystem } from '../../../../../../../modules/infrastructure/filesystem';
import {
  createGitBlobRef,
  DEFAULT_BRANCH,
  MigrationError,
  parseBranch,
} from '../../../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../../../utils/errors';
import { projectTypes } from '../../../../constants';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../../errors';
import {
  type BaseArtifactMetaData,
  CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION,
  ProjectFsPath,
  type ProjectId,
} from '../../../../models';
import { type SingleDocumentProjectStore } from '../../../../ports';

export const createAdapter = ({
  isoGitFs,
  filesystem,
  projectFilePath,
  internalProjectDir,
  projectName,
  documentInternalPath,
}: {
  // We have 2 filesystem APIs because isomorphic-git works well in both browser in Node.js
  // with its own implemented fs APIs, which more or less comply to the Node.js API.
  // In cases where we interact with the filesystem outside isomorphic-git (e.g. for listing files or normailizing paths),
  // we are using our own Filesystem API.
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  projectFilePath: ProjectFsPath;
  internalProjectDir: string;
  projectName: string;
  documentInternalPath: string;
}): SingleDocumentProjectStore => {
  const createSingleDocumentProject: SingleDocumentProjectStore['createSingleDocumentProject'] =
    () =>
      pipe(
        Effect.succeed(projectFilePath),
        Effect.tap(() =>
          Effect.tryPromise({
            try: () =>
              git.init({
                fs: isoGitFs,
                dir: internalProjectDir,
                defaultBranch: DEFAULT_BRANCH,
              }),
            catch: mapErrorTo(RepositoryError, 'Git repo error'),
          })
        )
      );

  const findProjectById: SingleDocumentProjectStore['findProjectById'] = (
    projectId
  ) =>
    pipe(
      getCurrentBranch({ projectId }),
      Effect.flatMap((currentBranch) =>
        Effect.try({
          try: () =>
            createGitBlobRef({
              ref: currentBranch,
              path: documentInternalPath,
            }),
          catch: mapErrorTo(
            ValidationError,
            'Cannot create the Git blob ref for the document'
          ),
        })
      ),
      // Ensure document path exists in the filesystem
      Effect.tap(() =>
        pipe(
          filesystem.readFile(documentInternalPath),
          Effect.catchTag('FilesystemNotFoundError', () =>
            Effect.fail(
              new NotFoundError(
                `File with path ${documentInternalPath} not found`
              )
            )
          ),
          Effect.catchAll(() =>
            Effect.fail(new RepositoryError('Git repo error'))
          )
        )
      ),
      Effect.map((documentId) => ({
        type: projectTypes.SINGLE_DOCUMENT_PROJECT,
        schemaVersion: CURRENT_SINGLE_DOCUMENT_PROJECT_SCHEMA_VERSION,
        document: {
          id: documentId,
        },
        name: projectName,
      }))
    );

  const getDocumentFromProject = (
    projectId: ProjectId
  ): Effect.Effect<
    BaseArtifactMetaData,
    ValidationError | NotFoundError | RepositoryError | MigrationError,
    never
  > =>
    pipe(
      findProjectById(projectId),
      Effect.map((project) => project.document)
    );

  const findDocumentInProject: SingleDocumentProjectStore['findDocumentInProject'] =
    (projectId) =>
      pipe(
        getDocumentFromProject(projectId),
        Effect.map((document) => document.id)
      );

  const getProjectName: SingleDocumentProjectStore['getProjectName'] = (id) =>
    pipe(
      findProjectById(id),
      Effect.map((project) => project.name)
    );

  const createAndSwitchToBranch: SingleDocumentProjectStore['createAndSwitchToBranch'] =
    ({ branch }) =>
      Effect.try({
        try: () =>
          git.branch({
            fs: isoGitFs,
            dir: internalProjectDir,
            ref: branch,
            checkout: true,
          }),
        catch: mapErrorTo(RepositoryError, 'Git repo error'),
      });

  const switchToBranch: SingleDocumentProjectStore['switchToBranch'] = ({
    branch,
  }) =>
    Effect.try({
      try: () =>
        git.checkout({
          fs: isoGitFs,
          dir: internalProjectDir,
          ref: branch,
        }),
      catch: mapErrorTo(RepositoryError, 'Git repo error'),
    });

  const getCurrentBranch: SingleDocumentProjectStore['getCurrentBranch'] = () =>
    pipe(
      Effect.tryPromise({
        try: () =>
          git.currentBranch({
            fs: isoGitFs,
            dir: internalProjectDir,
          }),
        catch: mapErrorTo(
          RepositoryError,
          'Error in getting the current branch'
        ),
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
          catch: mapErrorTo(RepositoryError, 'Could not parse current branch'),
        })
      )
    );

  const listBranches: SingleDocumentProjectStore['listBranches'] = () =>
    pipe(
      Effect.tryPromise({
        try: () =>
          git.listBranches({
            fs: isoGitFs,
            dir: internalProjectDir,
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
    );

  // This is a no-op in the Git document repo.
  const disconnect: SingleDocumentProjectStore['disconnect'] = () =>
    Effect.succeed(undefined);

  return {
    createSingleDocumentProject,
    findProjectById,
    findDocumentInProject,
    getProjectName,
    createAndSwitchToBranch,
    switchToBranch,
    getCurrentBranch,
    listBranches,
    disconnect,
  };
};
