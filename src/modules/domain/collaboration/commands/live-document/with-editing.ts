import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Stream from 'effect/Stream';

import { type LocalEditsContributionError } from '../../errors';
import { type ShareId } from '../../models';
import {
  type EditableLiveDocument,
  type LiveDocument,
  type LocalEditing,
} from './live-document';

export type EditContributor<EditorDocumentType> =
  LocalEditing<EditorDocumentType> & {
    // Contributions made to a document that was left mean nothing on the next
    // one.
    forgetPastContributions: Effect.Effect<void>;
    // Stops contributing, and closes the document once no contribution is in
    // flight.
    close: (closeDocument: Effect.Effect<void>) => Effect.Effect<void>;
    errors: Stream.Stream<LocalEditsContributionError>;
  };

export const withEditing =
  <DocumentType, ParticipantSelectionType, EditorDocumentType = DocumentType>(
    contributorFor: (
      document: LiveDocument<DocumentType, ParticipantSelectionType>
    ) => Effect.Effect<EditContributor<EditorDocumentType>>
  ) =>
  (
    document: LiveDocument<DocumentType, ParticipantSelectionType>
  ): Effect.Effect<
    EditableLiveDocument<
      DocumentType,
      ParticipantSelectionType,
      EditorDocumentType
    >
  > =>
    pipe(
      contributorFor(document),
      Effect.map((contributor) => {
        // Runs on another document from here on. Typing still on its way is
        // contributed to the document it was made on first.
        const applyEditsAndSwitch = <E>(
          switchDocument: Effect.Effect<void, E>
        ) =>
          pipe(
            contributor.applyPendingLocalEdits,
            Effect.zipRight(switchDocument),
            Effect.tap(() => contributor.forgetPastContributions)
          );

        return {
          ...document,
          edit: contributor.edit,
          applyPendingLocalEdits: contributor.applyPendingLocalEdits,
          dropPendingLocalEdits: contributor.dropPendingLocalEdits,
          attachTo: (shareId: ShareId) =>
            applyEditsAndSwitch(
              Effect.suspend(() => document.attachTo(shareId))
            ),
          detach: applyEditsAndSwitch(document.detach),
          errors: Stream.merge(contributor.errors, document.errors),
          close: contributor.close(document.close),
        };
      })
    );
