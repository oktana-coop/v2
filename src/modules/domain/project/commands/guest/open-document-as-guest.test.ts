import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it } from 'vitest';

import {
  type ConvergentDocument,
  type ConvergentDocumentState,
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type RemotePresence,
  type RichTextDocument,
  UnsupportedDocumentFormatError,
} from '../../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type Branch,
} from '../../../../../modules/infrastructure/version-control';
import { SharedDocumentUnavailableError } from '../../errors';
import {
  openDocumentAsGuest,
  type OpenDocumentAsGuestDeps,
} from './open-document-as-guest';

const markdown = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

const createFakeConvergentDocument = async (
  initialText: string
): Promise<ConvergentDocument> => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdown(initialText),
      version: 'v0',
    })
  );
  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>([])
  );

  return {
    content,
    presence: { peers, publish: () => Effect.void },
    change: (text) =>
      pipe(
        SubscriptionRef.set(content, { doc: markdown(text), version: 'v1' }),
        Effect.as('v1')
      ),
    errors: Stream.empty,
    close: Effect.void,
  };
};

// What the share says about its document.
const info = {
  branch: 'main' as Branch,
  documentId: '/blob/main/note.md' as ArtifactId,
  name: 'note',
};

const open = (deps: Partial<OpenDocumentAsGuestDeps> = {}) =>
  openDocumentAsGuest({
    getSharedDocumentInfo: () => Effect.succeed(info),
    openSharedDocument: () =>
      Effect.promise(() =>
        createFakeConvergentDocument('what the share holds')
      ),
    createPrivateDocument: (text) =>
      Effect.promise(() => createFakeConvergentDocument(text)),
    transformToText: async ({ input }: { input: string }) => input,
    ...deps,
  })({ shareId: 'automerge:pasted' });

describe('openDocumentAsGuest', () => {
  it('opens the share as a live document carrying its name, id and content', async () => {
    const guest = await Effect.runPromise(open());

    expect(guest.name).toBe(info.name);
    expect(guest.documentId).toBe(info.documentId);

    const current = await Effect.runPromise(SubscriptionRef.get(guest.content));
    expect(current.doc.content).toBe('what the share holds');
  });

  it('raises when the share cannot be reached', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        open({
          getSharedDocumentInfo: () =>
            Effect.fail(new SharedDocumentUnavailableError('out of reach')),
        })
      )
    );

    expect(failure).toBeInstanceOf(SharedDocumentUnavailableError);
  });

  it('raises when the share cannot be read', async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        open({
          openSharedDocument: () =>
            Effect.fail(new UnsupportedDocumentFormatError('a newer format')),
        })
      )
    );

    expect(failure).toBeInstanceOf(UnsupportedDocumentFormatError);
  });
});
