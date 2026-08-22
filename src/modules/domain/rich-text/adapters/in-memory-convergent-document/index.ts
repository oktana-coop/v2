import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
} from '../../models';
import {
  type ConvergentDocument,
  type ConvergentDocumentState,
} from '../../ports/convergent-document';

const asChange = (
  content: string,
  version: string
): ConvergentDocumentState => ({
  doc: {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    representation: PRIMARY_RICH_TEXT_REPRESENTATION,
    content,
  },
  version,
});

// Holds the live content in memory and publishes every change to subscribers.
// A change simply replaces the content; equal content is a silent no-op.
export const createAdapter = (
  initialText: string
): Effect.Effect<ConvergentDocument> =>
  pipe(
    SubscriptionRef.make<ConvergentDocumentState>(asChange(initialText, '0')),
    Effect.map((content) => ({
      content,
      change: (text: string) =>
        pipe(
          SubscriptionRef.get(content),
          Effect.flatMap((prev) =>
            // `SubscriptionRef.modify` publishes whatever it returns, so equal
            // content has to short-circuit before it to stay silent.
            prev.doc.content === text
              ? Effect.succeed(prev.version)
              : SubscriptionRef.modify(content, (current) => {
                  const next = asChange(
                    text,
                    String(Number(current.version) + 1)
                  );
                  // [effect result, new state].
                  return [next.version, next];
                })
          )
        ),
      // Nothing backs this document but itself.
      attachTo: () => Effect.void,
      detach: Effect.void,
      close: Effect.void,
    }))
  );
