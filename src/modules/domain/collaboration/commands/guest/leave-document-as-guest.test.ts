import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import {
  LocalEditsContributionError,
  SharedDocumentUnavailableError,
} from '../../errors';
import { type ShareId } from '../../models';
import { type EditableLiveDocument } from '../live-document';
import {
  leaveDocumentAsGuest,
  type LeaveDocumentAsGuestDeps,
} from './leave-document-as-guest';

const shareId = 'automerge:url' as ShareId;

// Mocks for a guest on a share, and the leave to run once the test has
// adjusted them.
const setUpLeave = async () => {
  const applyPendingLocalEdits = vi.fn<
    () => EditableLiveDocument['applyPendingLocalEdits']
  >(() => Effect.void);
  const close = vi.fn<() => Effect.Effect<void>>(() => Effect.void);
  const liveDocument: LeaveDocumentAsGuestDeps['liveDocument'] = {
    applyPendingLocalEdits: Effect.suspend(applyPendingLocalEdits),
    close: Effect.suspend(close),
  };
  const forgetShare = vi.fn<LeaveDocumentAsGuestDeps['forgetShare']>();
  // releaseShare returns an Effect: the command calls it while building its
  // steps, before contributing anything, and the Effect only runs afterwards.
  // `released` records the run, which is what the order and "never released"
  // checks need.
  const released = vi.fn();
  const releaseShare = vi.fn<LeaveDocumentAsGuestDeps['leaveSharedDocument']>(
    (args) => Effect.sync(() => released(args))
  );

  // Built when run, so mocks adjusted before running are in place by then.
  const leave = Effect.suspend(() =>
    leaveDocumentAsGuest({
      liveDocument,
      forgetShare,
      leaveSharedDocument: releaseShare,
    })(shareId)
  );

  return {
    leave,
    applyPendingLocalEdits,
    close,
    forgetShare,
    releaseShare,
    released,
  };
};

describe('leaveDocumentAsGuest', () => {
  it('contributes pending typing, closes the document, forgets the share, then releases it', async () => {
    const { leave, applyPendingLocalEdits, close, forgetShare, released } =
      await setUpLeave();

    await Effect.runPromise(leave);

    expect(applyPendingLocalEdits).toHaveBeenCalledBefore(close);
    expect(close).toHaveBeenCalledBefore(forgetShare);
    expect(forgetShare).toHaveBeenCalledBefore(released);
    expect(released).toHaveBeenCalledExactlyOnceWith({ shareId });
  });

  it('keeps the share when pending typing cannot be contributed', async () => {
    const { leave, applyPendingLocalEdits, close, forgetShare, released } =
      await setUpLeave();
    applyPendingLocalEdits.mockReturnValueOnce(
      Effect.fail(new LocalEditsContributionError('the conversion failed'))
    );

    const failure = await Effect.runPromise(Effect.flip(leave));

    expect(failure).toBeInstanceOf(LocalEditsContributionError);
    expect(close).not.toHaveBeenCalled();
    expect(forgetShare).not.toHaveBeenCalled();
    expect(released).not.toHaveBeenCalled();
  });

  it('leaves even when the release fails', async () => {
    const { leave, close, forgetShare, releaseShare } = await setUpLeave();
    releaseShare.mockReturnValueOnce(
      Effect.fail(new SharedDocumentUnavailableError('gone'))
    );

    await Effect.runPromise(leave);

    expect(close).toHaveBeenCalledOnce();
    expect(forgetShare).toHaveBeenCalledOnce();
  });
});
