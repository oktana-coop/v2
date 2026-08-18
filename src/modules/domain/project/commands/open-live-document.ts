import debounce from 'debounce';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import {
  type LiveDocument,
  type LiveDocumentVersion,
  type RepresentationTransform,
  type RichTextDocument,
} from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  MigrationError,
} from '../../../../modules/infrastructure/version-control';
import { subscribeToRefChanges } from '../../../../utils/effect';
import {
  NotFoundError,
  RepositoryError,
  ValidationError,
  VersionedProjectNotFoundErrorTag,
} from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import { persistDocument } from './persist-document';

export type Unsubscribe = () => void;

export type OpenError =
  ValidationError | RepositoryError | NotFoundError | MigrationError;

// The live document as the app uses it: the shared document plus the disk it
// is written to and followed from.
export type OpenLiveDocumentResult = LiveDocument & {
  flush: Effect.Effect<void>;
  refresh: Effect.Effect<void>;
  cancelPendingPersist: Effect.Effect<void>;
};

export type OpenLiveDocumentDeps = {
  // Takes what the store holds, for a document that has to be started from
  // it rather than found somewhere.
  createLiveDocument: (initialText: string) => Effect.Effect<LiveDocument>;
  transformToText: RepresentationTransform['transformToText'];
  findDocumentById: ProjectStore['findDocumentById'];
  updateRichTextDocumentContent: ProjectStore['updateRichTextDocumentContent'];
  subscribeToProjectDirChanges: (listener: () => void) => Unsubscribe;
  onPersistError: (error: unknown) => void;
};

export type OpenLiveDocumentArgs = {
  projectId: ProjectId;
  documentId: ArtifactId;
};

const PERSIST_DEBOUNCE_MS = 300;

export const openLiveDocument =
  ({
    createLiveDocument,
    transformToText,
    findDocumentById,
    updateRichTextDocumentContent,
    subscribeToProjectDirChanges,
    onPersistError,
  }: OpenLiveDocumentDeps) =>
  ({
    projectId,
    documentId,
  }: OpenLiveDocumentArgs): Effect.Effect<OpenLiveDocumentResult, OpenError> =>
    pipe(
      findDocumentById({ projectId, documentId }),
      Effect.flatMap(({ artifact }) =>
        pipe(
          createLiveDocument(artifact.content),
          Effect.flatMap((live) =>
            pipe(
              Effect.all({
                opened: SubscriptionRef.get(live.content),
                // Disk work runs strictly one after another: reading the
                // file, deciding, and writing it must not interleave. The
                // document itself needs no such ordering — merges commute.
                semaphore: Effect.makeSemaphore(1),
              }),
              Effect.map(({ opened, semaphore }) => ({
                diskText: artifact.content,
                live,
                opened,
                semaphore,
              }))
            )
          )
        )
      ),
      Effect.map(({ diskText, live, opened, semaphore }) => {
        const mutex = semaphore.withPermits(1);

        const persistToStore = persistDocument({
          transformToText,
          updateRichTextDocumentContent,
        });

        // What the file holds, as far as this document knows, and the
        // version that content derives from. The document may have opened on
        // a shared document holding something else, which the first write
        // then carries to the file.
        let lastPersisted = { content: diskText, version: opened.version };
        let cancelledVersion: LiveDocumentVersion | null = null;

        const persist = pipe(
          SubscriptionRef.get(live.content),
          Effect.flatMap((current) =>
            current.doc.content === lastPersisted.content ||
            current.version === cancelledVersion
              ? Effect.void
              : pipe(
                  persistToStore({
                    projectId,
                    documentId,
                    document: current.doc,
                  }),
                  Effect.map((written) => {
                    lastPersisted = {
                      content: written,
                      version: current.version,
                    };
                  })
                )
          )
        );

        const flush = mutex(
          pipe(
            Effect.sync(() => debouncedPersist.clear()),
            Effect.zipRight(persist),
            Effect.catchAll((error) => Effect.sync(() => onPersistError(error)))
          )
        );

        const debouncedPersist = debounce(() => {
          Effect.runPromise(flush).catch(onPersistError);
        }, PERSIST_DEBOUNCE_MS);

        // Marks the content as of now as not-to-persist; any later change
        // produces a new version, which persists again.
        const cancelPendingPersist = mutex(
          pipe(
            Effect.sync(() => debouncedPersist.clear()),
            Effect.zipRight(SubscriptionRef.get(live.content)),
            Effect.flatMap((current) =>
              Effect.sync(() => {
                cancelledVersion = current.version;
              })
            )
          )
        );

        // The file as another hand left it, contributed like any other
        // source: anchored at the state it was derived from, so text typed
        // meanwhile survives the merge. Content equal to what was last
        // written or read is this app's own echo, and a document that is
        // gone leaves nothing to pick up.
        const refresh = mutex(
          pipe(
            Effect.suspend(() => readDocument),
            Effect.flatMap((fresh) =>
              fresh === null || fresh.content === lastPersisted.content
                ? Effect.void
                : pipe(
                    Effect.sync(() => debouncedPersist.clear()),
                    Effect.zipRight(
                      live.change(fresh, { base: lastPersisted.version })
                    ),
                    Effect.map((version) => {
                      lastPersisted = { content: fresh.content, version };
                    })
                  )
            ),
            Effect.catchAll((error) => Effect.sync(() => onPersistError(error)))
          )
        );

        // Suspended so each read issues its own store call. A document that
        // is gone (e.g. renamed) leaves nothing to pick up, which is not a
        // failure.
        const readDocument = pipe(
          Effect.suspend(() => findDocumentById({ projectId, documentId })),
          Effect.map(({ artifact: fresh }): RichTextDocument | null => fresh),
          Effect.catchTag(VersionedProjectNotFoundErrorTag, () =>
            Effect.succeed(null)
          )
        );

        // The file follows the document: any new state, from any source,
        // arms a write.
        const unsubscribeFromContent = subscribeToRefChanges(live.content, () =>
          debouncedPersist()
        );

        // A document that opened on a shared one holds content the file has
        // never seen, and nothing more will publish it: bring the file up to
        // date.
        if (opened.doc.content !== diskText) debouncedPersist();

        const unsubscribeFromDisk = subscribeToProjectDirChanges(() => {
          Effect.runPromise(refresh).catch(onPersistError);
        });

        // The document keeps its content across a switch, but not its
        // versions: what the file holds now derives from the new document's
        // state, and nothing said about the old one still applies.
        const rebaseOnDocument = mutex(
          pipe(
            SubscriptionRef.get(live.content),
            Effect.flatMap((current) =>
              Effect.sync(() => {
                lastPersisted = {
                  content: lastPersisted.content,
                  version: current.version,
                };
                cancelledVersion = null;
              })
            )
          )
        );

        // Unsubscribe first, so the echo of the closing write cannot start a
        // refresh on a document that is going away.
        const close = pipe(
          Effect.sync(() => {
            unsubscribeFromDisk();
            unsubscribeFromContent();
          }),
          Effect.zipRight(flush),
          Effect.zipRight(live.close)
        );

        return {
          content: live.content,
          change: live.change,
          attachTo: (address) =>
            pipe(live.attachTo(address), Effect.zipRight(rebaseOnDocument)),
          detach: pipe(live.detach, Effect.zipRight(rebaseOnDocument)),
          flush,
          refresh,
          cancelPendingPersist,
          close,
        };
      })
    );
