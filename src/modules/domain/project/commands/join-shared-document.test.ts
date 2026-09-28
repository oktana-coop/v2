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
import { type ShareRegistry } from '../ports';
import { joinSharedDocument } from './join-shared-document';
import { type LiveDocument } from './live-document';
import { markdownDocument } from './test-utils';

const projectId = '/projects/one' as ProjectId;
const branch = 'main' as Branch;
const documentId = '/blob/main/note.md' as ArtifactId;

// A document already running, which the share may or may not be for.
const openDocumentFor = (openDocumentId: ArtifactId) => ({
  documentId: openDocumentId,
  attachTo: vi.fn<LiveDocument['attachTo']>(() => Effect.void),
});

const join = ({
  sharedBranch = branch,
  sharedDocumentId = documentId,
  documentIsInProject = true,
  rememberShare = vi.fn(),
  openDocument = null,
}: {
  sharedBranch?: Branch;
  sharedDocumentId?: ArtifactId;
  documentIsInProject?: boolean;
  rememberShare?: ShareRegistry['rememberShare'];
  openDocument?: ReturnType<typeof openDocumentFor> | null;
} = {}) =>
  joinSharedDocument({
    openDocument,
    getSharedDocumentInfo: () =>
      Effect.succeed({
        branch: sharedBranch,
        documentId: sharedDocumentId,
        name: 'note',
      }),
    findDocumentById: () =>
      documentIsInProject
        ? Effect.succeed({
            id: sharedDocumentId,
            artifact: markdownDocument('what this project holds'),
          })
        : Effect.fail(new NotFoundError('no such document')),
    rememberShare,
  })({ shareId: 'automerge:pasted', projectId, branch });

describe('joinSharedDocument', () => {
  it('finds the document the share was made from', async () => {
    const found = await Effect.runPromise(join());

    expect(found.documentId).toBe(documentId);
  });

  it('attaches the open document to the share when it is the one', async () => {
    const openDocument = openDocumentFor(documentId);

    const found = await Effect.runPromise(join({ openDocument }));

    expect(openDocument.attachTo).toHaveBeenCalledExactlyOnceWith(
      'automerge:pasted'
    );
    expect(found.attached).toBe(true);
  });

  it('leaves a share for another document to that document', async () => {
    const openDocument = openDocumentFor('/blob/main/other.md' as ArtifactId);

    const found = await Effect.runPromise(join({ openDocument }));

    // Attaching here would run the wrong file on the share.
    expect(openDocument.attachTo).not.toHaveBeenCalled();
    expect(found.attached).toBe(false);
  });

  it('takes no share up when nothing is open', async () => {
    const found = await Effect.runPromise(join());

    expect(found.attached).toBe(false);
  });

  it('remembers the share against that document', async () => {
    const rememberShare = vi.fn();

    await Effect.runPromise(join({ rememberShare }));

    expect(rememberShare).toHaveBeenCalledWith({
      key: { projectId, branch, documentId },
      shareId: 'automerge:pasted',
    });
  });

  it('refuses a share made on another branch', async () => {
    const rememberShare = vi.fn();

    const failure = await Effect.runPromise(
      Effect.flip(join({ sharedBranch: 'other' as Branch, rememberShare }))
    );

    expect(failure).toBeInstanceOf(SharedDocumentOnAnotherBranchError);
    expect(rememberShare).not.toHaveBeenCalled();
  });

  it('refuses a share whose document this project does not have', async () => {
    const rememberShare = vi.fn();

    const failure = await Effect.runPromise(
      Effect.flip(join({ documentIsInProject: false, rememberShare }))
    );

    expect(failure).toBeInstanceOf(SharedDocumentNotInProjectError);
    expect(rememberShare).not.toHaveBeenCalled();
  });
});
