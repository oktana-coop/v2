import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createNullPresence } from '../../../collaboration/adapters/automerge-presence';
import {
  type ParticipantSelection,
  type PrimaryRichTextDocument,
} from '../../models';
import { type RichTextConvergentDocument } from '../../ports/convergent-document';
import { createConvergentDocument } from './convergent-document';
import {
  type DocumentContent,
  initialDocumentContent,
} from './document-content';

export type PrivateConvergentDocumentDeps = {
  privateRepo: Effect.Effect<Repo>;
  initialDocument: PrimaryRichTextDocument;
};

export const createPrivateConvergentDocument = ({
  privateRepo,
  initialDocument,
}: PrivateConvergentDocumentDeps): Effect.Effect<RichTextConvergentDocument> =>
  pipe(
    Effect.all({
      handle: Effect.map(privateRepo, (repo) =>
        repo.create<DocumentContent>(
          initialDocumentContent(initialDocument.content)
        )
      ),
      presence: createNullPresence<ParticipantSelection>(),
    }),
    Effect.flatMap(createConvergentDocument)
  );
