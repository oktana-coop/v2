import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type ConvergentDocument,
  ConvergentDocumentChangeError,
  type ConvergentDocumentChangeOptions,
  type ConvergentDocumentError,
} from '../../../../../modules/domain/rich-text';
import {
  createErrorChannel,
  subscribeToRefChanges,
  subscribeToStream,
} from '../../../../../utils/effect';
import { mapErrorTo } from '../../../../../utils/errors';

export type SwitchableConvergentDocument = ConvergentDocument & {
  switchTo: (next: ConvergentDocument) => Effect.Effect<void>;
};

export type SwitchableConvergentDocumentDeps = {
  initial: ConvergentDocument;
};

// Creates a convergent document that can be replaced by another one while presenting
// itself as a single document throughout: `content` is the same stable ref before
// and after, so whoever follows it stays bound across a switch. Sharing, joining
// and leaving are switches.
export const createSwitchableDocument = ({
  initial,
}: SwitchableConvergentDocumentDeps): Effect.Effect<SwitchableConvergentDocument> =>
  pipe(
    Effect.all({
      // Create the stable ref
      initialContent: SubscriptionRef.get(initial.content),
      errorChannel: createErrorChannel<ConvergentDocumentError>(),
    }),
    Effect.flatMap(({ initialContent, errorChannel }) =>
      pipe(
        SubscriptionRef.make(initialContent),
        Effect.map((stableContentRef) => {
          let current = initial;

          const report = (error: ConvergentDocumentError) => {
            Effect.runSync(PubSub.publish(errorChannel, error));
          };

          // The only writer of the stable content ref: it mirrors whatever document
          // is current. `updateEffect` serializes the writes and reads the document
          // while holding the ref, so a late publish cannot land a staler state.
          const publishCurrent = SubscriptionRef.updateEffect(
            stableContentRef,
            () => SubscriptionRef.get(current.content)
          );

          const follow = (document: ConvergentDocument) => {
            const unfollowContent = subscribeToRefChanges(
              document.content,
              () => {
                Effect.runPromise(publishCurrent).catch((error) =>
                  report(
                    mapErrorTo(
                      ConvergentDocumentChangeError,
                      'A change could not be published.'
                    )(error)
                  )
                );
              }
            );
            const unfollowErrors = subscribeToStream(document.errors, report);

            return () => {
              unfollowContent();
              unfollowErrors();
            };
          };

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

          return {
            content: stableContentRef,
            change,
            errors: Stream.fromPubSub(errorChannel),
            switchTo,
            close,
          };
        })
      )
    )
  );
