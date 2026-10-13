import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';

import {
  type ConvergentDocumentChangeOptions,
  type EditContributor,
} from '../../collaboration';
import { type PlainTextDocument } from '../models';
import { type PlainTextConvergentDocument } from '../ports';

// How the editor's edits reach a plain-text document: the editor's whole
// document on every edit, contributed right away, so no edit is ever pending.
export const plainTextEditing = (
  document: Pick<PlainTextConvergentDocument, 'change'>
): Effect.Effect<EditContributor<PlainTextDocument>> =>
  pipe(
    Effect.makeSemaphore(1),
    Effect.map((contributionSemaphore) => {
      // Contributions reach the document one after another, in the order
      // they were made.
      const contributionMutex = contributionSemaphore.withPermits(1);

      const edit = (
        doc: PlainTextDocument,
        options?: ConvergentDocumentChangeOptions
      ) => contributionMutex(document.change(doc, options));

      return {
        edit,
        applyPendingLocalEdits: Effect.void,
        dropPendingLocalEdits: Effect.void,
        forgetPastContributions: Effect.void,
        close: (closeDocument: Effect.Effect<void>) =>
          contributionMutex(closeDocument),
        errors: Stream.empty,
      };
    })
  );
