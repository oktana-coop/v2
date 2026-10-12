import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';

import { type MigrationError } from '../../../../../modules/infrastructure/version-control';
import {
  type EditableLiveDocument,
  type EditableLiveDocumentError,
  type LocalEditsContributionError,
} from '../../../collaboration';
import {
  type DocumentNotOnCurrentRefError,
  type NotFoundError,
  type RepositoryError,
  type TextDecodingError,
  type ValidationError,
} from '../../errors';

export type StoredContentReadError =
  | ValidationError
  | RepositoryError
  | NotFoundError
  | MigrationError
  | DocumentNotOnCurrentRefError
  | TextDecodingError;

export type StoredCopyWriteError =
  | ValidationError
  | RepositoryError
  | NotFoundError
  | MigrationError
  | DocumentNotOnCurrentRefError;

// Failures with nobody waiting on them: the live document's, and the store's
// on reading and writing.
export type StoredLiveDocumentError =
  EditableLiveDocumentError | StoredContentReadError | StoredCopyWriteError;

export type StoredLiveDocument<
  DocumentType = unknown,
  ParticipantSelectionType = unknown,
  EditorDocumentType = DocumentType,
> = Omit<
  EditableLiveDocument<
    DocumentType,
    ParticipantSelectionType,
    EditorDocumentType
  >,
  'close' | 'errors'
> & {
  close: Effect.Effect<
    void,
    LocalEditsContributionError | StoredCopyWriteError
  >;
  flush: Effect.Effect<
    void,
    LocalEditsContributionError | StoredCopyWriteError
  >;
  refresh: Effect.Effect<void>;
  errors: Stream.Stream<StoredLiveDocumentError>;
};
