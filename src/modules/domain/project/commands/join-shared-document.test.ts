import * as Effect from 'effect/Effect';
import { describe, expect, it, vi } from 'vitest';

import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';
import {
  type DocumentSharing,
  type LiveDocument,
  type ShareId,
  UnsupportedDocumentFormatError,
} from '../../collaboration';
import {
  NotFoundError,
  SharedDocumentNotInProjectError,
  SharedDocumentOnAnotherBranchError,
  ValidationError,
} from '../errors';
import {
  artifactKinds,
  inferArtifactKindFromExtension,
  parseProjectRelPath,
  type ProjectId,
} from '../models';
import {
  joinSharedDocument,
  type JoinSharedDocumentDeps,
} from './join-shared-document';

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
  sharedDocumentId = documentId,
  sharedKind = artifactKinds.RICH_TEXT_DOCUMENT,
}: {
  openDocument?: ReturnType<typeof openDocumentFor> | null;
  sharedDocumentId?: ArtifactId;
  // What kind of document the share says it holds.
  sharedKind?: string;
} = {}) => {
  const sharedDocumentInfo = Effect.succeed({
    branch,
    documentId: sharedDocumentId,
    name: 'shared',
  });

  const getSharedDocumentKind = vi.fn<
    JoinSharedDocumentDeps['getSharedDocumentKind']
  >(() => Effect.succeed(sharedKind));
  // Resolves an id as a git store does: the id ends in the document's path.
  const getArtifactMetaDataById = vi.fn<
    JoinSharedDocumentDeps['getArtifactMetaDataById']
  >(({ artifactId }) => {
    const path = parseProjectRelPath(artifactId.split('/').slice(3).join('/'));

    return Effect.succeed({
      id: artifactId,
      path,
      kind: inferArtifactKindFromExtension(path),
    });
  });
  const getRichTextSharedDocumentInfo = vi.fn<
    DocumentSharing['getSharedDocumentInfo']
  >(() => sharedDocumentInfo);
  const getPlainTextSharedDocumentInfo = vi.fn<
    DocumentSharing['getSharedDocumentInfo']
  >(() => sharedDocumentInfo);
  const lookupArtifactInProject = vi.fn<
    JoinSharedDocumentDeps['lookupArtifactInProject']
  >(() => Effect.succeed(sharedDocumentId));
  const rememberShare = vi.fn<JoinSharedDocumentDeps['rememberShare']>();

  // Built when run: the command calls some dependencies while building its
  // steps, so mocks adjusted before running must be in place by then.
  const join = Effect.suspend(() =>
    joinSharedDocument({
      getSharedDocumentKind,
      getArtifactMetaDataById,
      getSharedDocumentInfo: {
        [artifactKinds.RICH_TEXT_DOCUMENT]: getRichTextSharedDocumentInfo,
        [artifactKinds.PLAIN_TEXT_DOCUMENT]: getPlainTextSharedDocumentInfo,
      },
      lookupArtifactInProject,
      rememberShare,
      openDocument,
    })({ shareId, projectId, branch })
  );

  return {
    join,
    getRichTextSharedDocumentInfo,
    getPlainTextSharedDocumentInfo,
    lookupArtifactInProject,
    rememberShare,
  };
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
    const { join, getRichTextSharedDocumentInfo, rememberShare } = setUpJoin();
    getRichTextSharedDocumentInfo.mockReturnValueOnce(
      Effect.succeed({ branch: 'other' as Branch, documentId, name: 'note' })
    );

    const failure = await Effect.runPromise(Effect.flip(join));

    expect(failure).toBeInstanceOf(SharedDocumentOnAnotherBranchError);
    expect(rememberShare).not.toHaveBeenCalled();
  });

  it('refuses a share whose document this project does not have', async () => {
    const { join, lookupArtifactInProject, rememberShare } = setUpJoin();
    lookupArtifactInProject.mockReturnValueOnce(
      Effect.fail(new NotFoundError('no such document'))
    );

    const failure = await Effect.runPromise(Effect.flip(join));

    expect(failure).toBeInstanceOf(SharedDocumentNotInProjectError);
    expect(rememberShare).not.toHaveBeenCalled();
  });

  it('refuses a share its kind of document cannot read', async () => {
    const { join, getRichTextSharedDocumentInfo, rememberShare } = setUpJoin();
    getRichTextSharedDocumentInfo.mockReturnValueOnce(
      Effect.fail(new UnsupportedDocumentFormatError('from a newer app'))
    );

    const failure = await Effect.runPromise(Effect.flip(join));

    expect(failure).toBeInstanceOf(UnsupportedDocumentFormatError);
    expect(rememberShare).not.toHaveBeenCalled();
  });

  it('reads a share of a plain-text document as plain text', async () => {
    const plainTextDocumentId = '/blob/main/config.yaml' as ArtifactId;
    const {
      join,
      getRichTextSharedDocumentInfo,
      getPlainTextSharedDocumentInfo,
    } = setUpJoin({
      sharedDocumentId: plainTextDocumentId,
      sharedKind: artifactKinds.PLAIN_TEXT_DOCUMENT,
    });

    const found = await Effect.runPromise(join);

    expect(found.documentId).toBe(plainTextDocumentId);
    expect(getPlainTextSharedDocumentInfo).toHaveBeenCalledExactlyOnceWith({
      shareId,
    });
    expect(getRichTextSharedDocumentInfo).not.toHaveBeenCalled();
  });

  it('refuses a share that does not hold a document', async () => {
    const { join, rememberShare } = setUpJoin({
      sharedKind: 'SOMETHING_ELSE',
    });

    const failure = await Effect.runPromise(Effect.flip(join));

    expect(failure).toBeInstanceOf(ValidationError);
    expect(rememberShare).not.toHaveBeenCalled();
  });
});
