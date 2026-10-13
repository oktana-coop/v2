import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import { type RemotePresence } from '../../models';
import { type ShareId } from '../../models';
import {
  type ConvergentDocument,
  type ConvergentDocumentState,
} from '../../ports';
import { createLiveDocument } from './create-live-document';
import { type LiveDocument } from './live-document';

// A kind of document of the tests' own, holding plain text.
type TextDocument = { text: string };

const documentId = '/blob/main/notes.txt' as ArtifactId;
const shareLink = 'automerge:the-share' as ShareId;

const createFakeConvergentDocument = async ({
  name,
  text,
}: {
  name: string;
  text: string;
}) => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState<TextDocument>>({
      doc: { text },
      version: `${name}.0`,
    })
  );
  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence<null>>>([])
  );
  const close = vi.fn();

  const document: ConvergentDocument<TextDocument, null> = {
    content,
    change: (doc) =>
      pipe(
        SubscriptionRef.set(content, { doc, version: `${name}.1` }),
        Effect.as(`${name}.1`)
      ),
    presence: { peers, publish: () => Effect.void },
    errors: Stream.empty,
    close: Effect.sync(close),
  };

  return { document, close };
};

const openDocument = async ({ text }: { text: string }) => {
  const initial = await createFakeConvergentDocument({ name: 'private', text });
  const share = await createFakeConvergentDocument({
    name: 'share',
    text: 'what the share holds',
  });

  const createPrivateDocument = vi.fn((doc: TextDocument) =>
    Effect.promise(() =>
      createFakeConvergentDocument({ name: 'detached', text: doc.text }).then(
        ({ document }) => document
      )
    )
  );
  const openSharedDocument = vi.fn(() => Effect.succeed(share.document));

  const opened = await Effect.runPromise(
    createLiveDocument({ createPrivateDocument, openSharedDocument })({
      documentId,
      initialDocument: initial.document,
    })
  );

  return { opened, initial, share, createPrivateDocument, openSharedDocument };
};

const stateOf = (opened: LiveDocument<TextDocument, null>) =>
  Effect.runPromise(SubscriptionRef.get(opened.content));

describe('createLiveDocument', () => {
  it('holds what its convergent document holds', async () => {
    const { opened } = await openDocument({ text: 'hello' });

    const document = await Effect.runPromise(opened.currentDocument);

    expect(document).toEqual({ text: 'hello' });
  });

  it('passes a change from another source to its convergent document', async () => {
    const { opened } = await openDocument({ text: 'hello' });

    const version = await Effect.runPromise(
      opened.change({ text: 'hello from elsewhere' }, { base: 'private.0' })
    );

    expect(version).toBe('private.1');
    const state = await stateOf(opened);
    expect(state.doc).toEqual({ text: 'hello from elsewhere' });
  });

  it('continues on the shared document behind a link', async () => {
    const { opened, initial, openSharedDocument } = await openDocument({
      text: 'hello',
    });

    await Effect.runPromise(opened.attachTo(shareLink));

    expect(openSharedDocument).toHaveBeenCalledWith({ shareId: shareLink });
    expect(initial.close).toHaveBeenCalledOnce();
    const state = await stateOf(opened);
    expect(state.doc).toEqual({ text: 'what the share holds' });
  });

  it('continues on a private document holding what the share left it holding', async () => {
    const { opened, share, createPrivateDocument } = await openDocument({
      text: 'hello',
    });
    await Effect.runPromise(opened.attachTo(shareLink));

    await Effect.runPromise(opened.detach);

    expect(createPrivateDocument).toHaveBeenCalledWith({
      text: 'what the share holds',
    });
    expect(share.close).toHaveBeenCalledOnce();
    const state = await stateOf(opened);
    expect(state.version).toBe('detached.0');
  });

  it('closes the convergent document it is on', async () => {
    const { opened, initial } = await openDocument({ text: 'hello' });

    await Effect.runPromise(opened.close);

    expect(initial.close).toHaveBeenCalledOnce();
  });
});
