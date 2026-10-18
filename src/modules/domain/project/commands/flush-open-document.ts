import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { PendingEditsNotSavedError } from '../errors';
import { type StoredLiveDocument } from './live-document';

export const flushOpenDocument = (
  openDocument: Pick<StoredLiveDocument, 'flush'>
) =>
  pipe(
    openDocument.flush,
    Effect.mapError(
      (cause) =>
        new PendingEditsNotSavedError(
          'The latest changes to the document could not be saved.',
          { cause }
        )
    )
  );
