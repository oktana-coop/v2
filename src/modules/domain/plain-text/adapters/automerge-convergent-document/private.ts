import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { createNullPresence } from '../../../collaboration/adapters/automerge-presence';
import {
  type PlainTextDocument,
  type PlainTextParticipantSelection,
} from '../../models';
import { type PlainTextConvergentDocument } from '../../ports';
import { createConvergentDocument } from './convergent-document';
import {
  type DocumentContent,
  initialDocumentContent,
} from './document-content';

export type PrivateConvergentDocumentDeps = {
  privateRepo: Effect.Effect<Repo>;
  initialDocument: PlainTextDocument;
};

export const createPrivateConvergentDocument = ({
  privateRepo,
  initialDocument,
}: PrivateConvergentDocumentDeps): Effect.Effect<PlainTextConvergentDocument> =>
  pipe(
    Effect.all({
      handle: Effect.map(privateRepo, (repo) =>
        repo.create<DocumentContent>(
          initialDocumentContent(initialDocument.content)
        )
      ),
      presence: createNullPresence<PlainTextParticipantSelection>(),
    }),
    Effect.flatMap(createConvergentDocument)
  );
