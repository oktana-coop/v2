import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type LiveDocument,
  type RepresentationTransform,
  type RichTextDocument,
} from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
  VersionedProjectNotFoundErrorTag,
} from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import { persistDocument, type PersistDocumentError } from './persist-document';

export type Unsubscribe = () => void;

export type PersistError = PersistDocumentError;

export type OpenError =
  ValidationError | RepositoryError | NotFoundError | MigrationError;

// The live document owns persistence and disk watching; the command's job
// is composition: look the document up and hand the adapter its disk in
// neutral terms — read, write, and a change signal.
export type LiveDocumentDiskDeps = {
  initialText: string;
  readDocument: Effect.Effect<RichTextDocument, unknown>;
  writeDocument: (doc: RichTextDocument) => Effect.Effect<string, unknown>;
  subscribeToDocumentChanges: (listener: () => void) => Unsubscribe;
};

export type OpenLiveDocumentResult = LiveDocument & {
  flush: Effect.Effect<void>;
  refresh: Effect.Effect<void>;
  cancelPendingPersist: Effect.Effect<void>;
};

export type OpenLiveDocumentDeps = {
  createLiveDocumentAdapter: (
    disk: LiveDocumentDiskDeps
  ) => Effect.Effect<OpenLiveDocumentResult>;
  transformToText: RepresentationTransform['transformToText'];
  findDocumentById: ProjectStore['findDocumentById'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
  subscribeToProjectDirChanges: (listener: () => void) => Unsubscribe;
  onPersistError: (error: unknown) => void;
  onRefreshOnDiskChangeError: (error: unknown) => void;
};

export type OpenLiveDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

export const openLiveDocument =
  ({
    createLiveDocumentAdapter,
    transformToText,
    findDocumentById,
    updateRichTextDocumentContent,
    subscribeToProjectDirChanges,
    onPersistError,
    onRefreshOnDiskChangeError,
  }: OpenLiveDocumentDeps) =>
  ({
    projectId,
    documentId,
  }: OpenLiveDocumentArgs): Effect.Effect<OpenLiveDocumentResult, OpenError> =>
    pipe(
      findDocumentById({ projectId, documentId }),
      Effect.flatMap(({ artifact }) => {
        const persistToStore = persistDocument({
          transformToText,
          updateRichTextDocumentContent,
        });

        // Suspended so each read issues its own store call; a vanished file
        // (e.g. a rename) is not worth reporting.
        const readDocument = pipe(
          Effect.suspend(() => findDocumentById({ projectId, documentId })),
          Effect.map(({ artifact: fresh }) => fresh),
          Effect.tapError((error) =>
            Effect.sync(() => {
              if (!(
                typeof error === 'object' &&
                error !== null &&
                '_tag' in error &&
                error._tag === VersionedProjectNotFoundErrorTag
              )) {
                onRefreshOnDiskChangeError(error);
              }
            })
          )
        );

        const writeDocument = (document: RichTextDocument) =>
          pipe(
            persistToStore({ projectId, documentId, document }),
            Effect.tapError((error) => Effect.sync(() => onPersistError(error)))
          );

        return createLiveDocumentAdapter({
          initialText: artifact.content,
          readDocument,
          writeDocument,
          subscribeToDocumentChanges: subscribeToProjectDirChanges,
        });
      })
    );
