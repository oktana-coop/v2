import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  DocumentAnalysisErrorTag,
  type DocumentAnalyzer,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  RichTextLibErrorTag,
  richTextRepresentations,
} from '../../../../../../modules/domain/rich-text';
import {
  type Filesystem,
  FilesystemAccessControlErrorTag,
  FilesystemDataIntegrityErrorTag,
  FilesystemNotFoundErrorTag,
  FilesystemRepositoryErrorTag,
  getParentPath,
} from '../../../../../../modules/infrastructure/filesystem';
import {
  type Commit,
  isGitCommitHash,
  readBlobAtCommit,
  stageAndCommitChangesToFiles as stageAndCommitChangesToFilesInGit,
  stageAndCommitWorkdirChanges,
  VersionControlNotFoundErrorTag,
  VersionControlRepositoryErrorTag,
} from '../../../../../../modules/infrastructure/version-control';
import { unique } from '../../../../../../utils/array';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
} from '../../../errors';
import {
  docRelToProjectRel,
  type ProjectFsPath,
  type ProjectRelPath,
} from '../../../models';
import { type ProjectStore } from '../../../ports';
import { extractArtifactRelativePathFromId } from './artifacts';
import { getDocumentReferencedAssetPaths } from './documents';
import { ensureProjectIdIsFsPath } from './project-id';

type CommittingOps = Pick<
  ProjectStore,
  'commitChanges' | 'commitDocumentChanges' | 'restoreDocumentChanges'
>;

export const createCommittingOps = ({
  isoGitFs,
  filesystem,
  documentAnalyzer,
}: {
  isoGitFs: IsoGitFsApi;
  filesystem: Filesystem;
  documentAnalyzer: DocumentAnalyzer;
}): CommittingOps => {
  const commitChanges: CommittingOps['commitChanges'] = ({
    projectId,
    message,
  }) =>
    pipe(
      ensureProjectIdIsFsPath(projectId),
      Effect.flatMap((projectPath) =>
        pipe(
          stageAndCommitWorkdirChanges({
            isoGitFs,
            dir: projectPath,
            message,
          }),
          Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
            Effect.fail(new RepositoryError(err.message))
          )
        )
      )
    );

  const stageAndCommitChangesToFiles = ({
    projectPath,
    paths,
    message,
  }: {
    projectPath: ProjectFsPath;
    paths: string[];
    message: string;
  }): Effect.Effect<Commit['id'], RepositoryError, never> =>
    pipe(
      stageAndCommitChangesToFilesInGit({
        isoGitFs,
        dir: projectPath,
        paths,
        message,
      }),
      Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
        Effect.fail(new RepositoryError(err.message))
      )
    );

  const commitDocumentChanges: CommittingOps['commitDocumentChanges'] = ({
    projectId,
    documentId,
    message,
  }) =>
    pipe(
      Effect.Do.pipe(
        Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
        Effect.bind('documentPath', () =>
          extractArtifactRelativePathFromId(documentId)
        ),
        // A document can reference an asset that is no longer on disk (a
        // deleted file, or a hand-authored/pasted dangling link). Staging a
        // missing path would fail the whole commit, so we check existence and
        // commit only the assets that are present, reporting the rest.
        Effect.bind('assets', ({ projectPath, documentPath }) =>
          pipe(
            getDocumentReferencedAssetPaths({
              filesystem,
              documentAnalyzer,
              projectPath,
              documentPath,
            }),
            Effect.flatMap((referencedAssetPaths) =>
              Effect.forEach(referencedAssetPaths, (assetPath) =>
                pipe(
                  filesystem.getAbsolutePath({
                    path: assetPath,
                    dirPath: projectPath,
                  }),
                  Effect.flatMap(filesystem.exists),
                  Effect.map((fileExists) => ({ assetPath, fileExists }))
                )
              )
            ),
            Effect.map((referencedAssetPathsWithExistsInfo) =>
              referencedAssetPathsWithExistsInfo.reduce<{
                existing: ProjectRelPath[];
                skipped: ProjectRelPath[];
              }>(
                (acc, { assetPath, fileExists }) =>
                  fileExists
                    ? { ...acc, existing: [...acc.existing, assetPath] }
                    : { ...acc, skipped: [...acc.skipped, assetPath] },
                { existing: [], skipped: [] }
              )
            )
          )
        ),
        Effect.bind('commitId', ({ projectPath, documentPath, assets }) =>
          stageAndCommitChangesToFiles({
            projectPath,
            paths: [documentPath, ...assets.existing],
            message,
          })
        ),
        Effect.map(({ commitId, assets }) => ({
          commitId,
          skippedAssetPaths: assets.skipped,
        }))
      ),
      Effect.catchTags({
        [FilesystemNotFoundErrorTag]: (err) =>
          Effect.fail(new NotFoundError(err.message)),
        [FilesystemAccessControlErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemRepositoryErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [FilesystemDataIntegrityErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [DocumentAnalysisErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
        [RichTextLibErrorTag]: (err) =>
          Effect.fail(new RepositoryError(err.message)),
      })
    );

  const writeFileEnsuringParent = ({
    absolutePath,
    content,
  }: {
    absolutePath: string;
    content: Uint8Array | string;
  }): Effect.Effect<void, RepositoryError, never> => {
    return pipe(
      filesystem.ensureDirectory({ path: getParentPath(absolutePath) }),
      Effect.flatMap(() =>
        filesystem.writeFile({ path: absolutePath, content })
      ),
      Effect.catchAll(() =>
        Effect.fail(new RepositoryError('Failed to write restored file'))
      )
    );
  };

  const restoreDocumentChanges: CommittingOps['restoreDocumentChanges'] = ({
    projectId,
    documentId,
    commit,
    message,
  }) =>
    Effect.Do.pipe(
      Effect.bind('projectPath', () => ensureProjectIdIsFsPath(projectId)),
      Effect.bind('documentPath', () =>
        extractArtifactRelativePathFromId(documentId)
      ),
      Effect.bind('restoreData', ({ projectPath, documentPath }) =>
        Effect.Do.pipe(
          Effect.bind('commitHash', () =>
            pipe(
              Effect.succeed(commit.id),
              Effect.filterOrFail(
                isGitCommitHash,
                (val) => new ValidationError(`Invalid commit hash: ${val}`)
              )
            )
          ),
          Effect.bind('docBytes', ({ commitHash }) =>
            pipe(
              readBlobAtCommit({
                isoGitFs,
                dir: projectPath,
                commitHash,
                filepath: documentPath,
              }),
              Effect.catchTag(VersionControlNotFoundErrorTag, (err) =>
                Effect.fail(new NotFoundError(err.message))
              ),
              Effect.catchTag(VersionControlRepositoryErrorTag, (err) =>
                Effect.fail(new RepositoryError(err.message))
              )
            )
          ),
          // Scan the historical doc content for asset refs.
          Effect.bind('referencedAssetPaths', ({ docBytes }) =>
            PRIMARY_RICH_TEXT_REPRESENTATION ===
            richTextRepresentations.MARKDOWN
              ? pipe(
                  documentAnalyzer.extractLocalAssetReferences({
                    representation: PRIMARY_RICH_TEXT_REPRESENTATION,
                    content: new TextDecoder().decode(docBytes),
                  }),
                  Effect.map((assetRefs) =>
                    unique(
                      assetRefs.map((docRel) =>
                        docRelToProjectRel({
                          docRel,
                          docPath: documentPath,
                        })
                      )
                    )
                  ),
                  Effect.catchTags({
                    [DocumentAnalysisErrorTag]: (err) =>
                      Effect.fail(new RepositoryError(err.message)),
                    [RichTextLibErrorTag]: (err) =>
                      Effect.fail(new RepositoryError(err.message)),
                  })
                )
              : Effect.succeed([] as ProjectRelPath[])
          ),
          // An asset referenced by the historical document may be absent from
          // the commit, or fail to read (e.g. a corrupt object). A single bad
          // asset must not abort the whole restore, so we skip any we cannot
          // read and restore the document plus the assets that are present,
          // reporting the rest.
          Effect.bind('assets', ({ commitHash, referencedAssetPaths }) =>
            pipe(
              Effect.forEach(referencedAssetPaths, (path) =>
                pipe(
                  readBlobAtCommit({
                    isoGitFs,
                    dir: projectPath,
                    commitHash,
                    filepath: path,
                  }),
                  Effect.map(
                    (bytes) => ({ path, bytes, restored: true }) as const
                  ),
                  Effect.catchTags({
                    [VersionControlNotFoundErrorTag]: () =>
                      Effect.succeed({ path, restored: false } as const),
                    [VersionControlRepositoryErrorTag]: () =>
                      Effect.succeed({ path, restored: false } as const),
                  })
                )
              ),
              Effect.map((entries) =>
                entries.reduce<{
                  toRestore: { path: ProjectRelPath; bytes: Uint8Array }[];
                  skipped: ProjectRelPath[];
                }>(
                  (acc, entry) =>
                    entry.restored
                      ? {
                          ...acc,
                          toRestore: [
                            ...acc.toRestore,
                            { path: entry.path, bytes: entry.bytes },
                          ],
                        }
                      : { ...acc, skipped: [...acc.skipped, entry.path] },
                  { toRestore: [], skipped: [] }
                )
              )
            )
          ),
          Effect.map(({ docBytes, assets }) => ({
            filesToRestore: [
              { path: documentPath, bytes: docBytes },
              ...assets.toRestore,
            ],
            skippedAssetPaths: assets.skipped,
          }))
        )
      ),
      Effect.tap(({ projectPath, restoreData }) =>
        Effect.forEach(
          restoreData.filesToRestore,
          ({ path, bytes }) =>
            pipe(
              filesystem.getAbsolutePath({ path, dirPath: projectPath }),
              Effect.flatMap((absPath) =>
                writeFileEnsuringParent({
                  absolutePath: absPath,
                  content: bytes,
                })
              ),
              Effect.catchAll(() =>
                Effect.fail(
                  new RepositoryError('Failed to write restored file')
                )
              )
            ),
          { discard: true }
        )
      ),
      Effect.bind('commitId', ({ projectPath, restoreData }) =>
        stageAndCommitChangesToFiles({
          projectPath,
          paths: restoreData.filesToRestore.map((f) => f.path),
          message: message ?? `Restore ${commit.message}`,
        })
      ),
      Effect.map(({ commitId, restoreData }) => ({
        commitId,
        skippedAssetPaths: restoreData.skippedAssetPaths,
      }))
    );

  return { commitChanges, commitDocumentChanges, restoreDocumentChanges };
};
