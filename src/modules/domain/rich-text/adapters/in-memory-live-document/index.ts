import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { type RichTextDocument } from '../../models';
import {
  type LiveDocument,
  type LiveDocumentChange,
} from '../../ports/live-document';

const sameContent = (a: RichTextDocument, b: RichTextDocument): boolean =>
  a.representation === b.representation && a.content === b.content;

export const createAdapter = (
  initial: RichTextDocument
): Effect.Effect<LiveDocument> =>
  pipe(
    SubscriptionRef.make<LiveDocumentChange>({ doc: initial, version: '0' }),
    Effect.map((content) => ({
      content,
      change: (doc: RichTextDocument) =>
        pipe(
          SubscriptionRef.get(content),
          Effect.flatMap((prev) =>
            // `SubscriptionRef.modify` publishes whatever it returns, so equal
            // content has to short-circuit before it to stay silent.
            sameContent(prev.doc, doc)
              ? Effect.succeed(prev.version)
              : SubscriptionRef.modify(content, (current) => {
                  const next = {
                    doc,
                    version: String(Number(current.version) + 1),
                  };
                  return [next.version, next];
                })
          )
        ),
    }))
  );
