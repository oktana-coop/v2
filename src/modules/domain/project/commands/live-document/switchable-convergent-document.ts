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
  type LocalPresence,
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
// itself as a single document throughout: `content` and `presence.peers` are the
// same stable refs before and after, so whoever follows them stays bound across a
// switch. Sharing, joining and leaving are switches.
export const createSwitchableDocument = ({
  initial,
}: SwitchableConvergentDocumentDeps): Effect.Effect<SwitchableConvergentDocument> =>
  pipe(
    Effect.all({
      // Create the stable refs
      initialContent: SubscriptionRef.get(initial.content),
      initialPeers: SubscriptionRef.get(initial.presence.peers),
      errorChannel: createErrorChannel<ConvergentDocumentError>(),
    }),
    Effect.flatMap(({ initialContent, initialPeers, errorChannel }) =>
      pipe(
        Effect.all({
          stableContentRef: SubscriptionRef.make(initialContent),
          stablePeersRef: SubscriptionRef.make(initialPeers),
        }),
        Effect.map(({ stableContentRef, stablePeersRef }) => {
          let current = initial;
          // What we last said about ourselves, said again to whatever
          // document comes next.
          let lastPublished: LocalPresence | null = null;

          const report = (error: ConvergentDocumentError) => {
            Effect.runSync(PubSub.publish(errorChannel, error));
          };

          // The only writers of the stable refs: they mirror whatever document
          // is current. `updateEffect` serializes the writes and reads the document
          // while holding the ref, so a late publish cannot land a staler state.
          const publishCurrent = SubscriptionRef.updateEffect(
            stableContentRef,
            () => SubscriptionRef.get(current.content)
          );

          const publishCurrentPeers = SubscriptionRef.updateEffect(
            stablePeersRef,
            () => SubscriptionRef.get(current.presence.peers)
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
            const unfollowPeers = subscribeToRefChanges(
              document.presence.peers,
              () => {
                Effect.runFork(publishCurrentPeers);
              }
            );
            const unfollowErrors = subscribeToStream(document.errors, report);

            return () => {
              unfollowContent();
              unfollowPeers();
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

          const publishPresence = (state: LocalPresence) =>
            pipe(
              Effect.sync(() => {
                lastPublished = state;
              }),
              Effect.zipRight(
                Effect.suspend(() => current.presence.publish(state))
              )
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
              Effect.zipRight(
                Effect.suspend(() =>
                  lastPublished === null
                    ? Effect.void
                    : next.presence.publish(lastPublished)
                )
              ),
              Effect.zipRight(publishCurrent),
              Effect.zipRight(publishCurrentPeers)
            );

          const close = pipe(
            Effect.sync(() => unfollow()),
            Effect.zipRight(Effect.suspend(() => current.close))
          );

          return {
            content: stableContentRef,
            presence: { peers: stablePeersRef, publish: publishPresence },
            change,
            errors: Stream.fromPubSub(errorChannel),
            switchTo,
            close,
          };
        })
      )
    )
  );
