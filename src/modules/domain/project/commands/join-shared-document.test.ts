import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';
import {
  NotFoundError,
  SharedDocumentNotInProjectError,
  SharedDocumentOnAnotherBranchError,
} from '../errors';
import { type ProjectId } from '../models';
import { type ShareId } from '../ports';
import {
  joinSharedDocument,
  type JoinSharedDocumentDeps,
} from './join-shared-document';
import { type LiveDocument } from './live-document';
import { markdownDocument } from './test-utils';

const projectId = '/projects/one' as ProjectId;
const branch = 'main' as Branch;
const documentId = '/blob/main/note.md' as ArtifactId;
const shareId = 'automerge:pasted' as ShareId;

// A document already running, which the share may or may not be for.
const openDocumentFor = (openDocumentId: ArtifactId) => ({
  documentId: openDocumentId,
  attachTo: vi.fn<LiveDocument['attachTo']>(() => Effect.void),
});

// Mocks for a share made from this project's document on this branch, and
// the join to run once the test has adjusted them.
const setUpJoin = ({
  openDocument = null,
}: {
  openDocument?: ReturnType<typeof openDocumentFor> | null;
} = {}) => {
  const getSharedDocumentInfo = vi.fn<
    JoinSharedDocumentDeps['getSharedDocumentInfo']
  >(() => Effect.succeed({ branch, documentId, name: 'note' }));
  const findDocumentById = vi.fn<JoinSharedDocumentDeps['findDocumentById']>(
    ({ documentId: foundId }) =>
      Effect.succeed({
        id: foundId,
        artifact: markdownDocument('what this project holds'),
      })
  );
  const rememberShare = vi.fn<JoinSharedDocumentDeps['rememberShare']>();

  // Built when run: the command calls some dependencies while building its
  // steps, so mocks adjusted before running must be in place by then.
  const join = Effect.suspend(() =>
    joinSharedDocument({
      getSharedDocumentInfo,
      findDocumentById,
      rememberShare,
      openDocument,
    })({ shareId, projectId, branch })
  );

  return { join, getSharedDocumentInfo, findDocumentById, rememberShare };
};

describe('joinSharedDocument', () => {
  it('finds the document the share was made from', async () => {
    const { join } = setUpJoin();

    const found = await Effect.runPromise(join);

    expect(found.documentId).toBe(documentId);
  });

  it('attaches the open document to the share when it is the one', async () => {
    const openDocument = openDocumentFor(documentId);
    const { join } = setUpJoin({ openDocument });

    const found = await Effect.runPromise(join);

    expect(openDocument.attachTo).toHaveBeenCalledExactlyOnceWith(shareId);
    expect(found.attached).toBe(true);
  });

  it('leaves a share for another document to that document', async () => {
    const openDocument = openDocumentFor('/blob/main/other.md' as ArtifactId);
    const { join } = setUpJoin({ openDocument });

    const found = await Effect.runPromise(join);

    // Attaching here would run the wrong file on the share.
    expect(openDocument.attachTo).not.toHaveBeenCalled();
    expect(found.attached).toBe(false);
  });

  it('takes no share up when nothing is open', async () => {
    const { join } = setUpJoin({ openDocument: null });

    const found = await Effect.runPromise(join);

    expect(found.attached).toBe(false);
  });

  it('remembers the share against that document', async () => {
    const { join, rememberShare } = setUpJoin();

    await Effect.runPromise(join);

    expect(rememberShare).toHaveBeenCalledExactlyOnceWith({
      key: { projectId, branch, documentId },
      shareId,
    });
  });

  it('refuses a share made on another branch', async () => {
    const { join, getSharedDocumentInfo, rememberShare } = setUpJoin();
    getSharedDocumentInfo.mockReturnValueOnce(
      Effect.succeed({ branch: 'other' as Branch, documentId, name: 'note' })
    );

    const failure = await Effect.runPromise(Effect.flip(join));

    expect(failure).toBeInstanceOf(SharedDocumentOnAnotherBranchError);
    expect(rememberShare).not.toHaveBeenCalled();
  });

  it('refuses a share whose document this project does not have', async () => {
    const { join, findDocumentById, rememberShare } = setUpJoin();
    findDocumentById.mockReturnValueOnce(
      Effect.fail(new NotFoundError('no such document'))
    );

    const failure = await Effect.runPromise(Effect.flip(join));

    expect(failure).toBeInstanceOf(SharedDocumentNotInProjectError);
    expect(rememberShare).not.toHaveBeenCalled();
  });
});
