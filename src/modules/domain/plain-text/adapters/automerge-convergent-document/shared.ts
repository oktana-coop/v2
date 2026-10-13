import { type DocHandle } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { ValidationError } from '../../../collaboration';
import { createPresence } from '../../../collaboration/adapters/automerge-presence';
import { parseParticipantSelection, selectionsAreSame } from '../../models';
import { type PlainTextConvergentDocument } from '../../ports';
import { createConvergentDocument } from './convergent-document';
import { type DocumentContent } from './document-content';

export type SharedConvergentDocumentDeps = {
  handle: DocHandle<DocumentContent>;
};

export const createSharedConvergentDocument = ({
  handle,
}: SharedConvergentDocumentDeps): Effect.Effect<PlainTextConvergentDocument> =>
  pipe(
    createPresence({
      handle,
      selection: {
        parse: (value) =>
          pipe(
            parseParticipantSelection(value),
            Effect.mapError(mapErrorTo(ValidationError))
          ),
        areSame: selectionsAreSame,
      },
    }),
    Effect.flatMap((presence) => createConvergentDocument({ handle, presence }))
  );
