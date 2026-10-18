import { type DocHandle, type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import {
  type UnsupportedDocumentFormatError,
  ValidationError,
} from '../../errors';
import {
  type ConvergentDocument,
  type DocumentSharing,
  type GetSharedDocumentInfoArgs,
  type LeaveSharedDocumentArgs,
  type OpenSharedDocumentArgs,
  type SharedDocumentResolver,
  type ShareDocumentArgs,
} from '../../ports';
import { connect, createShare, findShare, releaseShare } from './repo';
import {
  checkSharedDocumentKind,
  initialSharedDocumentContent,
  readSharedDocumentInfo,
  readSharedDocumentKind,
} from './shared-document';

export type AutomergeBinding<
  DocumentType,
  ParticipantSelectionType,
  AutomergeContentType,
> = {
  // The Automerge content a document of this kind starts as.
  initialContent: (doc: DocumentType) => AutomergeContentType;
  // Reads an Automerge document as this kind's content, in a format this app
  // implements.
  parse: (
    handle: DocHandle<unknown>
  ) => Effect.Effect<
    DocHandle<AutomergeContentType>,
    UnsupportedDocumentFormatError | ValidationError
  >;
  open: (
    handle: DocHandle<AutomergeContentType>
  ) => Effect.Effect<
    ConvergentDocument<DocumentType, ParticipantSelectionType>
  >;
};

export type AutomergeDocumentSharingDeps<
  DocumentType,
  ParticipantSelectionType,
  AutomergeContentType,
> = {
  // This is an effect because we want to lazily connect on first share/join.
  syncedRepo: Effect.Effect<Repo, unknown>;
  // The kind of document this adapter shares. Every share stores it, so it
  // must stay the same across versions.
  kind: string;
  binding: AutomergeBinding<
    DocumentType,
    ParticipantSelectionType,
    AutomergeContentType
  >;
};

export const createResolverAdapter = ({
  syncedRepo,
}: {
  syncedRepo: Effect.Effect<Repo, unknown>;
}): SharedDocumentResolver => ({
  getSharedDocumentKind: ({ shareId }) =>
    pipe(
      connect(syncedRepo),
      Effect.flatMap((repo) => findShare({ repo, shareId })),
      Effect.flatMap(readSharedDocumentKind)
    ),
});

export const createAdapter = <
  DocumentType,
  ParticipantSelectionType,
  AutomergeContentType,
>({
  syncedRepo,
  kind,
  binding,
}: AutomergeDocumentSharingDeps<
  DocumentType,
  ParticipantSelectionType,
  AutomergeContentType
>): DocumentSharing<DocumentType, ParticipantSelectionType> => {
  // Reused effect across document-related operations.
  const connectedRepo = connect(syncedRepo);

  const findReadableShare = (shareId: string) =>
    pipe(
      connectedRepo,
      Effect.flatMap((repo) => findShare({ repo, shareId })),
      Effect.tap((handle) => checkSharedDocumentKind({ handle, kind })),
      Effect.flatMap(binding.parse)
    );

  const shareDocument = ({ doc, ...info }: ShareDocumentArgs<DocumentType>) =>
    pipe(
      connectedRepo,
      Effect.map((repo) =>
        createShare({
          repo,
          content: initialSharedDocumentContent({
            kind,
            content: binding.initialContent(doc),
            ...info,
          }),
        })
      )
    );

  const openSharedDocument = ({ shareId }: OpenSharedDocumentArgs) =>
    pipe(findReadableShare(shareId), Effect.flatMap(binding.open));

  const getSharedDocumentInfo = ({ shareId }: GetSharedDocumentInfoArgs) =>
    pipe(findReadableShare(shareId), Effect.flatMap(readSharedDocumentInfo));

  const leaveSharedDocument = ({ shareId }: LeaveSharedDocumentArgs) =>
    pipe(
      connectedRepo,
      Effect.flatMap((repo) => releaseShare({ repo, shareId }))
    );

  return {
    shareDocument,
    openSharedDocument,
    getSharedDocumentInfo,
    leaveSharedDocument,
  };
};
