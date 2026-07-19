import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, {
  type HttpClient as IsoGitHttpApi,
  type PromiseFsClient as IsoGitFsApi,
} from 'isomorphic-git';

import {
  type Filesystem,
  FilesystemRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/filesystem';
import {
  type ArtifactId,
  cloneRepository as cloneGitRepo,
  createGitBlobRef,
  DEFAULT_BRANCH,
  VersionControlRepositoryErrorTag,
  writeGitignore,
} from '../../../../../../modules/infrastructure/version-control';
import { mapErrorTo } from '../../../../../../utils/errors';
import { RepositoryError, ValidationError } from '../../../errors';
import {
  type AssetMetaData,
  CURRENT_PROJECT_SCHEMA_VERSION,
  type DocumentMetaData,
  inferArtifactKindFromExtension,
  isAssetMetaData,
  isDocumentMetaData,
  parseProjectFsPath,
  parseProjectRelPathEffect,
  type ProjectId,
} from '../../../models';
import { type ProjectStore } from '../../../ports';
import { ensureAuthTokenIsProvided, setAuthorInfo } from './auth';
import { getCurrentBranch } from './branching';
import { ensureProjectIdIsFsPath } from './project-id';

const getDirectoryFiles = ({
  filesystem,
  id,
}: {
  filesystem: Filesystem;
  id: ProjectId;
}) =>
  pipe(
    ensureProjectIdIsFsPath(id),
    Effect.flatMap((projectPath) =>
      pipe(
        filesystem.listDirectoryFiles({
          path: projectPath,
          useRelativePath: true,
          recursive: true,
        }),
        Effect.catchAll(() =>
          Effect.fail(new RepositoryError('Git repo error'))
        )
      )
    )
  );

export const findProjectById = ({
  isoGitFs,
  filesystem,
  id,
}: {
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  id: ProjectId;
}): ReturnType<ProjectStore['findProjectById']> =>
  Effect.Do.pipe(
    Effect.bind('files', () => getDirectoryFiles({ filesystem, id })),
    Effect.bind('currentBranch', () =>
      pipe(
        ensureProjectIdIsFsPath(id),
        Effect.flatMap((projectDir) =>
          getCurrentBranch({ isoGitFs, projectDir })
        )
      )
    ),
    Effect.flatMap(({ files, currentBranch }) =>
      Effect.reduce(
        files,
        {
          documents: {} as Record<ArtifactId, DocumentMetaData>,
          assets: {} as Record<ArtifactId, AssetMetaData>,
        },
        (acc, file) =>
          pipe(
            parseProjectRelPathEffect(file.path),
            Effect.map((path) => {
              // TODO: Handle errors returned by createGitBlobRef
              const artifactId = createGitBlobRef({
                ref: currentBranch,
                path,
              });
              const artifact = {
                id: artifactId,
                path,
                kind: inferArtifactKindFromExtension(path),
              };

              if (isDocumentMetaData(artifact)) {
                acc.documents[artifactId] = artifact;
              } else if (isAssetMetaData(artifact)) {
                acc.assets[artifactId] = artifact;
              }

              return acc;
            })
          )
      )
    ),
    Effect.map(({ documents, assets }) => ({
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      path: id,
      documents,
      assets,
    }))
  );

export const listProjectDocuments = ({
  isoGitFs,
  filesystem,
  id,
}: {
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  id: ProjectId;
}): ReturnType<ProjectStore['listProjectDocuments']> =>
  pipe(
    findProjectById({ isoGitFs, filesystem, id }),
    Effect.map((project) => Object.values(project.documents))
  );

type ProjectOps = Pick<
  ProjectStore,
  | 'createProject'
  | 'findProjectById'
  | 'listProjectDocuments'
  | 'getProjectRelativePath'
>;

export const createProjectOps = ({
  isoGitFs,
  isoGitHttp,
  filesystem,
}: {
  isoGitFs: IsoGitFsApi;
  isoGitHttp: IsoGitHttpApi;
  filesystem: Filesystem;
}): ProjectOps => {
  const createProject: ProjectOps['createProject'] = ({
    path,
    cloneUrl,
    authToken: authTokenInput,
    username,
    email,
  }) =>
    pipe(
      Effect.try({
        try: () => parseProjectFsPath(path),
        catch: mapErrorTo(ValidationError, 'Invalid project path'),
      }),
      Effect.tap((projectPath) =>
        cloneUrl
          ? pipe(
              ensureAuthTokenIsProvided(authTokenInput),
              Effect.flatMap((authToken) =>
                pipe(
                  cloneGitRepo({
                    isoGitFs,
                    isoGitHttp,
                    dir: projectPath,
                    url: cloneUrl,
                    authToken,
                  }),
                  Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                    Effect.fail(new RepositoryError(err.message))
                  )
                )
              )
            )
          : pipe(
              Effect.tryPromise({
                try: () =>
                  git.init({
                    fs: isoGitFs,
                    dir: projectPath,
                    defaultBranch: DEFAULT_BRANCH,
                  }),
                catch: mapErrorTo(RepositoryError, 'Git repo error'),
              }),
              Effect.tap(() =>
                pipe(
                  writeGitignore({ isoGitFs, dir: projectPath }),
                  Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                    Effect.fail(new RepositoryError(err.message))
                  )
                )
              )
            )
      ),
      Effect.tap((projectPath) =>
        setAuthorInfo({ isoGitFs, projectId: projectPath, username, email })
      )
    );

  const findProjectByIdOp: ProjectOps['findProjectById'] = (id) =>
    findProjectById({ isoGitFs, filesystem, id });

  const listProjectDocumentsOp: ProjectOps['listProjectDocuments'] = (id) =>
    listProjectDocuments({ isoGitFs, filesystem, id });

  const getProjectRelativePath: ProjectOps['getProjectRelativePath'] = ({
    projectId,
    absolutePath,
  }) =>
    pipe(
      filesystem.isDescendantPath({
        parent: projectId,
        possibleDescendant: absolutePath,
      }),
      Effect.flatMap((isInside) =>
        isInside
          ? filesystem.getRelativePath({
              path: absolutePath,
              relativeTo: projectId,
            })
          : Effect.succeed(null)
      ),
      Effect.catchTag(FilesystemRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  return {
    createProject,
    findProjectById: findProjectByIdOp,
    listProjectDocuments: listProjectDocumentsOp,
    getProjectRelativePath,
  };
};
