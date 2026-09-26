import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { RepresentationTransformError } from '../../../../../modules/domain/rich-text';
import { SharedDocumentUnavailableError } from '../../errors';
import { leaveDocumentAsGuest } from './leave-document-as-guest';

describe('leaveDocumentAsGuest', () => {
  it('contributes pending typing, closes the document, forgets the share, then releases it', async () => {
    const calls: string[] = [];

    await Effect.runPromise(
      leaveDocumentAsGuest({
        liveDocument: {
          applyPendingLocalEdits: Effect.sync(() => {
            calls.push('applyPendingLocalEdits');
          }),
          close: Effect.sync(() => {
            calls.push('close');
          }),
        },
        forgetShare: () => calls.push('forget'),
        leaveSharedDocument: ({ shareId }) =>
          Effect.sync(() => {
            calls.push(`release:${shareId}`);
          }),
      })('automerge:url')
    );

    expect(calls).toEqual([
      'applyPendingLocalEdits',
      'close',
      'forget',
      'release:automerge:url',
    ]);
  });

  it('keeps the share when pending typing cannot be contributed', async () => {
    const calls: string[] = [];

    const failure = await Effect.runPromise(
      Effect.flip(
        leaveDocumentAsGuest({
          liveDocument: {
            applyPendingLocalEdits: Effect.fail(
              new RepresentationTransformError('the conversion failed')
            ),
            close: Effect.sync(() => {
              calls.push('close');
            }),
          },
          forgetShare: () => calls.push('forget'),
          leaveSharedDocument: ({ shareId }) =>
            Effect.sync(() => {
              calls.push(`release:${shareId}`);
            }),
        })('automerge:url')
      )
    );

    expect(failure).toBeInstanceOf(RepresentationTransformError);
    expect(calls).toEqual([]);
  });

  it('leaves even when the release fails', async () => {
    const calls: string[] = [];

    await Effect.runPromise(
      leaveDocumentAsGuest({
        liveDocument: {
          applyPendingLocalEdits: Effect.sync(() => {
            calls.push('applyPendingLocalEdits');
          }),
          close: Effect.sync(() => {
            calls.push('close');
          }),
        },
        forgetShare: () => calls.push('forget'),
        leaveSharedDocument: ({ shareId }) =>
          Effect.fail(new SharedDocumentUnavailableError(`gone: ${shareId}`)),
      })('automerge:url')
    );

    expect(calls).toEqual(['applyPendingLocalEdits', 'close', 'forget']);
  });
});
