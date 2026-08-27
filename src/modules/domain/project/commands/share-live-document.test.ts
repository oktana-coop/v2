import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import {
  type ConvergentDocumentState,
  CURRENT_SCHEMA_VERSION,
  PRIMARY_RICH_TEXT_REPRESENTATION,
} from '../../../../modules/domain/rich-text';
import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';
import {
  NotFoundError,
  SharedDocumentNotInProjectError,
  SharedDocumentOnAnotherBranchError,
  SharedDocumentUnavailableError,
} from '../errors';
import { type ProjectId } from '../models';
import { type ShareUrl } from '../ports';
import { joinSharedDocument } from './join-shared-document';
import { leaveSharedDocument } from './leave-shared-document';
import { type LiveDocument } from './live-document';
import { shareLiveDocument } from './share-live-document';

// A live document that records what was asked of it, in order.
const createLiveDocument = async ({
  content = 'what the editor shows',
  calls = [],
  attachFails = false,
}: {
  content?: string;
  calls?: string[];
  attachFails?: boolean;
} = {}): Promise<Pick<LiveDocument, 'content' | 'attachTo' | 'detach'>> => {
  const contentRef = await Effect.runPromise(
    SubscriptionRef.make<ConvergentDocumentState>({
      doc: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        representation: PRIMARY_RICH_TEXT_REPRESENTATION,
        content,
      },
      version: '0',
    })
  );

  return {
    content: contentRef,

    attachTo: (shareUrl) =>
      attachFails
        ? Effect.fail(new SharedDocumentUnavailableError('unreachable'))
        : Effect.sync(() => {
            calls.push(`attach:${shareUrl}`);
          }),
    detach: Effect.sync(() => {
      calls.push('detach');
    }),
  };
};

// How the document being shared is named inside the project.
const sharedFrom = {
  branch: 'main' as Branch,
  documentId: '/blob/main/note.md' as ArtifactId,
};

describe('shareLiveDocument', () => {
  it('mints what the document holds, attaches to it, and remembers the share', async () => {
    const calls: string[] = [];
    const liveDocument = await createLiveDocument({ calls });

    const url = await Effect.runPromise(
      shareLiveDocument({
        liveDocument,
        shareDocument: ({ content, branch, documentId }) =>
          Effect.sync(() => {
            calls.push(`mint:${content}@${branch}:${documentId}`);
            return 'automerge:url';
          }),
        rememberShare: (shareUrl) => calls.push(`remember:${shareUrl}`),
      })(sharedFrom)
    );

    expect(url).toBe('automerge:url');
    // The share is minted carrying the document it was made from.
    expect(calls).toEqual([
      'mint:what the editor shows@main:/blob/main/note.md',
      'attach:automerge:url',
      'remember:automerge:url',
    ]);
  });

  it('remembers nothing when attaching fails', async () => {
    const rememberShare = vi.fn();
    const liveDocument = await createLiveDocument({ attachFails: true });

    const failure = await Effect.runPromise(
      Effect.flip(
        shareLiveDocument({
          liveDocument,
          shareDocument: () => Effect.succeed('automerge:url'),
          rememberShare,
        })(sharedFrom)
      )
    );

    expect(failure).toBeInstanceOf(SharedDocumentUnavailableError);
    expect(rememberShare).not.toHaveBeenCalled();
  });
});

describe('joinSharedDocument', () => {
  const projectId = '/projects/one' as ProjectId;
  const branch = 'main' as Branch;
  const documentId = '/blob/main/note.md' as ArtifactId;

  // A document already running, which the share may or may not be for.
  const openDocumentFor = (
    openDocumentId: ArtifactId,
    attached: string[] = []
  ) => ({
    documentId: openDocumentId,
    attachTo: (shareUrl: ShareUrl) =>
      Effect.sync(() => {
        attached.push(shareUrl);
      }),
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
    rememberShare?: (args: {
      documentId: ArtifactId;
      shareUrl: ShareUrl;
    }) => void;
    openDocument?: ReturnType<typeof openDocumentFor> | null;
  } = {}) =>
    joinSharedDocument({
      openDocument,
      getSharedDocumentIdentity: () =>
        Effect.succeed({
          branch: sharedBranch,
          documentId: sharedDocumentId,
        }),
      findDocumentById: () =>
        documentIsInProject
          ? Effect.succeed({
              id: sharedDocumentId,
              artifact: {
                schemaVersion: CURRENT_SCHEMA_VERSION,
                representation: PRIMARY_RICH_TEXT_REPRESENTATION,
                content: 'what this project holds',
              },
            })
          : Effect.fail(new NotFoundError('no such document')),
      rememberShare,
    })({ shareUrl: 'automerge:pasted', projectId, branch });

  it('finds the document the share was made from', async () => {
    const found = await Effect.runPromise(join());

    expect(found.documentId).toBe(documentId);
  });

  it('runs the open document on the share when it is the one', async () => {
    const attached: string[] = [];

    const found = await Effect.runPromise(
      join({ openDocument: openDocumentFor(documentId, attached) })
    );

    expect(attached).toEqual(['automerge:pasted']);
    expect(found.attached).toBe(true);
  });

  it('leaves a share for another document to that document', async () => {
    const attached: string[] = [];
    const somethingElse = '/blob/main/other.md' as ArtifactId;

    const found = await Effect.runPromise(
      join({ openDocument: openDocumentFor(somethingElse, attached) })
    );

    // Attaching here would run the wrong file on the share.
    expect(attached).toEqual([]);
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
      documentId,
      shareUrl: 'automerge:pasted',
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

describe('leaveSharedDocument', () => {
  it('forgets the share, detaches the document, then releases it', async () => {
    const calls: string[] = [];
    const liveDocument = await createLiveDocument({ calls });

    await Effect.runPromise(
      leaveSharedDocument({
        liveDocument,
        forgetShare: () => calls.push('forget'),
        leaveSharedDocument: ({ shareUrl }) =>
          Effect.sync(() => {
            calls.push(`release:${shareUrl}`);
          }),
      })('automerge:url')
    );

    expect(calls).toEqual(['forget', 'detach', 'release:automerge:url']);
  });
});
