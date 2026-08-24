import { type Repo } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ConvergentDocument } from '../../ports/convergent-document';
import {
  type AutomergeConvergentDocumentDeps,
  createConvergentDocument,
} from './convergent-document';
import {
  type DocumentContent,
  initialDocumentContent,
} from './document-content';

export type PrivateConvergentDocumentDeps = Omit<
  AutomergeConvergentDocumentDeps,
  'handle'
> & {
  privateRepo: Effect.Effect<Repo>;
  initialText: string;
};

export const createPrivateConvergentDocument = ({
  privateRepo,
  initialText,
  onError,
}: PrivateConvergentDocumentDeps): Effect.Effect<ConvergentDocument> =>
  pipe(
    privateRepo,
    Effect.map((repo) =>
      repo.create<DocumentContent>(initialDocumentContent(initialText))
    ),
    Effect.flatMap((handle) => createConvergentDocument({ handle, onError }))
  );
