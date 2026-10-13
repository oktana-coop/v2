import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import { type ArtifactId } from '../../../../../modules/infrastructure/version-control';
import {
  createErrorChannel,
  subscribeToStream,
} from '../../../../../utils/effect';
import {
  ConvergentDocumentChangeError,
  LocalEditsContributionError,
} from '../../errors';
import { type RemotePresence } from '../../models';
import { type ShareId } from '../../models';
import {
  type ConvergentDocumentError,
  type ConvergentDocumentState,
} from '../../ports';
import { type LiveDocument } from './live-document';
import { type EditContributor, withEditing } from './with-editing';

type TextDocument = { text: string };

const shareLink = 'automerge:the-share' as ShareId;

const createFakeLiveDocument = async () => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState<TextDocument>>({
      doc: { text: 'hello' },
      version: 'v0',
    })
  );
  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence<null>>>([])
  );
  const errorChannel =
    await Effect.runPromise(createErrorChannel<ConvergentDocumentError>());
  const attachTo = vi.fn(() => Effect.void);
  const detach = vi.fn(() => Effect.void);
  const close = vi.fn(() => Effect.void);

  const document: LiveDocument<TextDocument, null> = {
    documentId: '/blob/main/notes.txt' as ArtifactId,
    content,
    currentDocument: Effect.succeed({ text: 'hello' }),
    change: () => Effect.succeed('v1'),
    presence: { peers, publish: () => Effect.void },
    attachTo,
    detach: Effect.suspend(detach),
    errors: Stream.fromPubSub(errorChannel),
    close: Effect.suspend(close),
  };

  return { document, attachTo, detach, close, errorChannel };
};

const createFakeContributor = async () => {
  const errorChannel =
    await Effect.runPromise(createErrorChannel<LocalEditsContributionError>());
  const applyPendingLocalEdits = vi.fn<
    () => EditContributor<TextDocument>['applyPendingLocalEdits']
  >(() => Effect.void);
  const forgetPastContributions = vi.fn(() => Effect.void);
  const close = vi.fn<EditContributor<TextDocument>['close']>(
    (closeDocument) => closeDocument
  );

  const contributor: EditContributor<TextDocument> = {
    edit: () => Effect.succeed('v1'),
    applyPendingLocalEdits: Effect.suspend(applyPendingLocalEdits),
    dropPendingLocalEdits: Effect.void,
    forgetPastContributions: Effect.suspend(forgetPastContributions),
    close,
    errors: Stream.fromPubSub(errorChannel),
  };

  return {
    contributor,
    applyPendingLocalEdits,
    forgetPastContributions,
    close,
    errorChannel,
  };
};

const openEditable = async () => {
  const live = await createFakeLiveDocument();
  const editing = await createFakeContributor();

  const editable = await Effect.runPromise(
    withEditing<TextDocument, null>(() => Effect.succeed(editing.contributor))(
      live.document
    )
  );

  return { editable, live, editing };
};

describe('withEditing', () => {
  it('contributes pending typing before attaching, and forgets past contributions after', async () => {
    const { editable, live, editing } = await openEditable();

    await Effect.runPromise(editable.attachTo(shareLink));

    expect(live.attachTo).toHaveBeenCalledWith(shareLink);
    const [applied] = editing.applyPendingLocalEdits.mock.invocationCallOrder;
    const [attached] = live.attachTo.mock.invocationCallOrder;
    const [forgotten] =
      editing.forgetPastContributions.mock.invocationCallOrder;
    expect(applied).toBeLessThan(attached);
    expect(attached).toBeLessThan(forgotten);
  });

  it('contributes pending typing before detaching, and forgets past contributions after', async () => {
    const { editable, live, editing } = await openEditable();

    await Effect.runPromise(editable.detach);

    const [applied] = editing.applyPendingLocalEdits.mock.invocationCallOrder;
    const [detached] = live.detach.mock.invocationCallOrder;
    const [forgotten] =
      editing.forgetPastContributions.mock.invocationCallOrder;
    expect(applied).toBeLessThan(detached);
    expect(detached).toBeLessThan(forgotten);
  });

  it('does not switch documents when pending typing cannot be contributed', async () => {
    const { editable, live, editing } = await openEditable();
    editing.applyPendingLocalEdits.mockReturnValueOnce(
      Effect.fail(new LocalEditsContributionError('cannot contribute'))
    );

    const failure = await Effect.runPromise(
      Effect.flip(editable.attachTo(shareLink))
    );

    expect(failure).toBeInstanceOf(LocalEditsContributionError);
    expect(live.attachTo).not.toHaveBeenCalled();
    expect(editing.forgetPastContributions).not.toHaveBeenCalled();
  });

  it('closes the document through the contributor', async () => {
    const { editable, live, editing } = await openEditable();

    await Effect.runPromise(editable.close);

    expect(editing.close).toHaveBeenCalledOnce();
    expect(live.close).toHaveBeenCalledOnce();
  });

  it('reports what the contributor and the document report', async () => {
    const { editable, live, editing } = await openEditable();
    const reported = vi.fn();
    subscribeToStream(editable.errors, reported);
    const fromContributor = new LocalEditsContributionError(
      'contribution failed'
    );
    const fromDocument = new ConvergentDocumentChangeError('document failed');

    await vi.waitFor(async () => {
      await Effect.runPromise(
        PubSub.publish(editing.errorChannel, fromContributor)
      );
      await Effect.runPromise(PubSub.publish(live.errorChannel, fromDocument));
      expect(reported).toHaveBeenCalledWith(fromContributor);
      expect(reported).toHaveBeenCalledWith(fromDocument);
    });
  });
});
