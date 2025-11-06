import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import git, { type PromiseFsClient as NodeLikeFsApi } from 'isomorphic-git';

import {
  decomposeGitBlobRef,
  isGitBlobRef,
  versionedArtifactTypes,
} from '../../../../../modules/infrastructure/version-control';
import { fromNullable } from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';
import { NotFoundError, RepositoryError, ValidationError } from '../../errors';
import { CURRENT_SCHEMA_VERSION, ResolvedDocument } from '../../models';
import { VersionedDocumentStore } from '../../ports/versioned-document-store';
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

  const createDocument: VersionedDocumentStore['createDocument'] = ({ id }) =>
    pipe(
      fromNullable(
        id,
        () =>
          new ValidationError(
            'Id is required when creating a document in the Git repo'
          )
      ),
      Effect.filterOrFail(
        isGitBlobRef,
        (val) => new ValidationError(`Invalid document id: ${val}`)
      )
    );

  const findDocumentById: VersionedDocumentStore['findDocumentById'] = (id) =>
    pipe(
      Effect.succeed(id),
      Effect.filterOrFail(
        isGitBlobRef,
        (val) => new ValidationError(`Invalid document id: ${val}`)
      ),
      Effect.map((gitBlobRef) => {
        const { path: documentPath } = decomposeGitBlobRef(gitBlobRef);
        return documentPath;
      }),
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

  return {
    projectId,
    setProjectId,
    createDocument,
    findDocumentById,
    getDocumentHeads,
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
