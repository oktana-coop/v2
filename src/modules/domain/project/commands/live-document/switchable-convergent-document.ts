import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type ConvergentDocument,
  type ConvergentDocumentChangeOptions,
} from '../../../../../modules/domain/rich-text';
import { subscribeToRefChanges } from '../../../../../utils/effect';

export type SwitchableConvergentDocument = ConvergentDocument & {
  switchTo: (next: ConvergentDocument) => Effect.Effect<void>;
};

export type SwitchableConvergentDocumentDeps = {
  initial: ConvergentDocument;
  onError: (error: unknown) => void;
};

// Creates a convergent document that can be replaced by another one while presenting
// itself as a single document throughout: `content` is the same stable ref before
// and after, so whoever follows it stays bound across a switch. Sharing, joining
// and leaving are switches.
export const createSwitchableDocument = ({
  initial,
  onError,
}: SwitchableConvergentDocumentDeps): Effect.Effect<SwitchableConvergentDocument> =>
  pipe(
    SubscriptionRef.get(initial.content),
    // Create the stable ref
    Effect.flatMap((initialContent) => SubscriptionRef.make(initialContent)),
    Effect.map((stableContentRef) => {
      let current = initial;

      // The only writer of the stable content ref: it mirrors whatever document
      // is current. `updateEffect` serializes the writes and reads the document
      // while holding the ref, so a late publish cannot land a staler state.
      const publishCurrent = SubscriptionRef.updateEffect(
        stableContentRef,
        () => SubscriptionRef.get(current.content)
      );

      const follow = (document: ConvergentDocument) =>
        subscribeToRefChanges(document.content, () => {
          Effect.runPromise(publishCurrent).catch(onError);
        });

      let unfollow = follow(initial);

      const change = (
        text: string,
        options?: ConvergentDocumentChangeOptions
      ) =>
        pipe(
          Effect.suspend(() => current.change(text, options)),
          // Ensure that the version a change resolves with is already published, so a
          // contributor can recognize its own echo.
          Effect.tap(() => publishCurrent)
        );

      // Runs on the given document from here on. Published even when the
      // text is identical: subscribers must learn the version to derive
      // their next base from.
      const switchTo = (next: ConvergentDocument) =>
        pipe(
          Effect.sync(() => {
            const previous = current;

            unfollow();
            current = next;
            unfollow = follow(next);

            return previous;
          }),
          Effect.flatMap((previous) => previous.close),
          Effect.zipRight(publishCurrent)
        );

      const close = pipe(
        Effect.sync(() => unfollow()),
        Effect.zipRight(Effect.suspend(() => current.close))
      );

      return { content: stableContentRef, change, switchTo, close };
    })
  );
