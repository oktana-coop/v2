import * as Effect from 'effect/Effect';

import {
  type ConvergentDocument,
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentVersion,
  type RichTextDocument,
} from '../../../../modules/domain/rich-text';

// The live document as the app uses it: the convergent document itself plus
// the disk it is written to and followed from. `openLiveDocument` is what
// builds one.
export type LiveDocument = Omit<ConvergentDocument, 'change'> & {
  // Takes the document in whatever representation its source holds, which
  // the primary text one the convergent document takes is converted from.
  change: (
    doc: RichTextDocument,
    options?: ConvergentDocumentChangeOptions
  ) => Effect.Effect<ConvergentDocumentVersion>;
  flush: Effect.Effect<void>;
  refresh: Effect.Effect<void>;
  cancelPendingPersist: Effect.Effect<void>;
};
