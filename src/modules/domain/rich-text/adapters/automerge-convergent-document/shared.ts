import { type DocHandle } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { type ConvergentDocument } from '../../ports/convergent-document';
import { createConvergentDocument } from './convergent-document';
import { type DocumentContent } from './document-content';
import { createPresence } from './presence';

export type SharedConvergentDocumentDeps = {
  handle: DocHandle<DocumentContent>;
};

export const createSharedConvergentDocument = ({
  handle,
}: SharedConvergentDocumentDeps): Effect.Effect<ConvergentDocument> =>
  pipe(
    createPresence({ handle }),
    Effect.flatMap((presence) => createConvergentDocument({ handle, presence }))
  );
