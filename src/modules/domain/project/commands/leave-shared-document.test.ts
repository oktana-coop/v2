import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import { RepresentationTransformError } from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';
import { SharedDocumentUnavailableError } from '../errors';
import { type ProjectId } from '../models';
import {
  leaveSharedDocument,
  type LeaveSharedDocumentDeps,
} from './leave-shared-document';
import { createFakeLiveDocument } from './test-utils';

const shareKey = {
  projectId: '/projects/one' as ProjectId,
  branch: 'main' as Branch,
  documentId: '/blob/main/note.md' as ArtifactId,
};

const setUpLeave = async () => {
  const { liveDocument, detach } = await createFakeLiveDocument();
  const findShareId = vi.fn<LeaveSharedDocumentDeps['findShareId']>(
    () => 'automerge:url'
  );
  const forgetShare = vi.fn<LeaveSharedDocumentDeps['forgetShare']>();
  // The release is built before the document detaches and runs after, so what
  // the test watches is the release running.
  const released = vi.fn();
  const releaseShare = vi.fn<LeaveSharedDocumentDeps['leaveSharedDocument']>(
    (args) => Effect.sync(() => released(args))
  );

  const leave = leaveSharedDocument({
    liveDocument,
    findShareId,
    forgetShare,
    leaveSharedDocument: releaseShare,
  })(shareKey);

  return { leave, detach, findShareId, forgetShare, releaseShare, released };
};

describe('leaveSharedDocument', () => {
  it('detaches the document, forgets the share, then releases it', async () => {
    const { leave, detach, forgetShare, released } = await setUpLeave();

    await Effect.runPromise(leave);

    expect(detach).toHaveBeenCalledBefore(forgetShare);
    expect(forgetShare).toHaveBeenCalledExactlyOnceWith(shareKey);
    expect(forgetShare).toHaveBeenCalledBefore(released);
    expect(released).toHaveBeenCalledExactlyOnceWith({
      shareId: 'automerge:url',
    });
  });

  it('keeps the share when the document refuses to detach', async () => {
    const { leave, detach, forgetShare, released } = await setUpLeave();
    detach.mockReturnValueOnce(
      Effect.fail(new RepresentationTransformError('the conversion failed'))
    );

    const failure = await Effect.runPromise(Effect.flip(leave));

    expect(failure).toBeInstanceOf(RepresentationTransformError);
    expect(forgetShare).not.toHaveBeenCalled();
    expect(released).not.toHaveBeenCalled();
  });

  it('leaves even when the release fails', async () => {
    const { leave, detach, forgetShare, releaseShare } = await setUpLeave();
    releaseShare.mockReturnValueOnce(
      Effect.fail(new SharedDocumentUnavailableError('gone'))
    );

    await Effect.runPromise(leave);

    expect(detach).toHaveBeenCalledOnce();
    expect(forgetShare).toHaveBeenCalledOnce();
  });

  it('leaves a document that takes part in no share as it is', async () => {
    const { leave, detach, findShareId, forgetShare, released } =
      await setUpLeave();
    findShareId.mockReturnValueOnce(null);

    await Effect.runPromise(leave);

    expect(detach).not.toHaveBeenCalled();
    expect(forgetShare).not.toHaveBeenCalled();
    expect(released).not.toHaveBeenCalled();
  });
});
