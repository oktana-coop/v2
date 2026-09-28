import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it } from 'vitest';

import {
  type ConvergentDocument,
  type ConvergentDocumentState,
  type RemotePresence,
  UnsupportedDocumentFormatError,
} from '../../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type Branch,
} from '../../../../../modules/infrastructure/version-control';
import { SharedDocumentUnavailableError } from '../../errors';
import { contentOf, markdownDocument } from '../test-utils';
import {
  openDocumentAsGuest,
  type OpenDocumentAsGuestDeps,
} from './open-document-as-guest';

const createFakeConvergentDocument = async (
  initialText: string
): Promise<ConvergentDocument> => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdownDocument(initialText),
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
        SubscriptionRef.set(content, {
          doc: markdownDocument(text),
          version: 'v1',
        }),
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
    createPrivateDocument: () =>
      Effect.die('no private document in these tests'),
    transformToText: () =>
      Promise.reject(new Error('no conversion in these tests')),
    ...deps,
  })({ shareId: 'automerge:pasted' });

describe('openDocumentAsGuest', () => {
  it('opens the share as a live document carrying its name, id and content', async () => {
    const guest = await Effect.runPromise(open());

    expect(guest.name).toBe(info.name);
    expect(guest.documentId).toBe(info.documentId);

    const content = await contentOf(guest);
    expect(content).toBe('what the share holds');
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
