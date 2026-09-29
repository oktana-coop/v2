import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

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
import { type ShareId } from '../../ports';
import { contentOf, markdownDocument } from '../test-utils';
import {
  openDocumentAsGuest,
  type OpenDocumentAsGuestDeps,
} from './open-document-as-guest';

const shareId = 'automerge:pasted' as ShareId;

// What the share says about its document.
const info = {
  branch: 'main' as Branch,
  documentId: '/blob/main/note.md' as ArtifactId,
  name: 'note',
};

const createFakeConvergentDocument = async (
  text: string
): Promise<ConvergentDocument> => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: markdownDocument(text),
      version: 'v0',
    })
  );
  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>([])
  );

  return {
    content,
    presence: { peers, publish: () => Effect.void },
    change: () => Effect.die('no changes in these tests'),
    errors: Stream.empty,
    close: Effect.void,
  };
};

// Mocks for a reachable, readable share, and the opening to run once the test
// has adjusted them.
const setUpOpen = ({
  shareText = 'on the share',
}: {
  // What the share holds.
  shareText?: string;
} = {}) => {
  const getSharedDocumentInfo = vi.fn<
    OpenDocumentAsGuestDeps['getSharedDocumentInfo']
  >(() => Effect.succeed(info));
  const openSharedDocument = vi.fn<
    OpenDocumentAsGuestDeps['openSharedDocument']
  >(() => Effect.promise(() => createFakeConvergentDocument(shareText)));

  // Built when run, so mocks adjusted before running are in place by then.
  const open = Effect.suspend(() =>
    openDocumentAsGuest({
      getSharedDocumentInfo,
      openSharedDocument,
      createPrivateDocument: () =>
        Effect.die('no private document in these tests'),
      transformToText: () =>
        Promise.reject(new Error('no conversion in these tests')),
    })({ shareId })
  );

  return { open, getSharedDocumentInfo, openSharedDocument };
};

describe('openDocumentAsGuest', () => {
  it('opens the share as a live document carrying its name, id and content', async () => {
    const { open, getSharedDocumentInfo, openSharedDocument } = setUpOpen({
      shareText: 'what the share holds',
    });

    const guest = await Effect.runPromise(open);

    expect(getSharedDocumentInfo).toHaveBeenCalledExactlyOnceWith({ shareId });
    expect(openSharedDocument).toHaveBeenCalledExactlyOnceWith({ shareId });
    expect(guest.name).toBe(info.name);
    expect(guest.documentId).toBe(info.documentId);
    const content = await contentOf(guest);
    expect(content).toBe('what the share holds');
  });

  it('raises when the share cannot be reached', async () => {
    const { open, getSharedDocumentInfo } = setUpOpen();
    getSharedDocumentInfo.mockReturnValueOnce(
      Effect.fail(new SharedDocumentUnavailableError('out of reach'))
    );

    const failure = await Effect.runPromise(Effect.flip(open));

    expect(failure).toBeInstanceOf(SharedDocumentUnavailableError);
  });

  it('raises when the share cannot be read', async () => {
    const { open, openSharedDocument } = setUpOpen();
    openSharedDocument.mockReturnValueOnce(
      Effect.fail(new UnsupportedDocumentFormatError('a newer format'))
    );

    const failure = await Effect.runPromise(Effect.flip(open));

    expect(failure).toBeInstanceOf(UnsupportedDocumentFormatError);
  });
});
