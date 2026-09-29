import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';
import { SharedDocumentUnavailableError } from '../errors';
import { type ProjectId } from '../models';
import {
  shareLiveDocument,
  type ShareLiveDocumentDeps,
} from './share-live-document';
import { createFakeLiveDocument } from './test-utils';

const projectId = '/projects/one' as ProjectId;
const branch = 'main' as Branch;
const documentId = '/blob/main/note.md' as ArtifactId;

const setUpShare = async () => {
  const { liveDocument, applyPendingLocalEdits, attachTo } =
    await createFakeLiveDocument();
  const shareDocument = vi.fn<ShareLiveDocumentDeps['shareDocument']>(() =>
    Effect.succeed('automerge:url')
  );
  const rememberShare = vi.fn<ShareLiveDocumentDeps['rememberShare']>();

  // Built when run, so mocks adjusted before running are in place by then.
  const share = Effect.suspend(() =>
    shareLiveDocument({
      liveDocument,
      shareDocument,
      rememberShare,
    })({ projectId, branch, documentId, name: 'note' })
  );

  return {
    share,
    applyPendingLocalEdits,
    attachTo,
    shareDocument,
    rememberShare,
  };
};

describe('shareLiveDocument', () => {
  it('mints what the document holds, attaches to it, and remembers the share', async () => {
    const {
      share,
      applyPendingLocalEdits,
      attachTo,
      shareDocument,
      rememberShare,
    } = await setUpShare();

    const shareId = await Effect.runPromise(share);

    expect(shareId).toBe('automerge:url');
    // The share is minted carrying the document it was made from, once
    // everything typed has reached it.
    expect(applyPendingLocalEdits).toHaveBeenCalledBefore(shareDocument);
    expect(shareDocument).toHaveBeenCalledExactlyOnceWith({
      content: 'what the editor shows',
      branch,
      documentId,
      name: 'note',
    });
    expect(attachTo).toHaveBeenCalledExactlyOnceWith('automerge:url');
    expect(attachTo).toHaveBeenCalledBefore(rememberShare);
    expect(rememberShare).toHaveBeenCalledExactlyOnceWith({
      key: { projectId, branch, documentId },
      shareId: 'automerge:url',
    });
  });

  it('remembers nothing when attaching fails', async () => {
    const { share, attachTo, rememberShare } = await setUpShare();
    attachTo.mockReturnValueOnce(
      Effect.fail(new SharedDocumentUnavailableError('unreachable'))
    );

    const failure = await Effect.runPromise(Effect.flip(share));

    expect(failure).toBeInstanceOf(SharedDocumentUnavailableError);
    expect(rememberShare).not.toHaveBeenCalled();
  });
});
