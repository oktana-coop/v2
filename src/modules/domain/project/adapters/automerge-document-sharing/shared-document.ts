import { type DocHandle } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../../../utils/errors';
import {
  parseArtifactId,
  parseBranch,
} from '../../../../infrastructure/version-control';
import { ValidationError } from '../../../rich-text';
import {
  type DocumentContent,
  documentContentSchema,
  initialDocumentContent,
} from '../../../rich-text/adapters/automerge-convergent-document';
import { type SharedDocumentIdentity } from '../../ports';

const identitySchema = z.object({
  branch: z.string(),
  documentId: z.string(),
});

const sharedDocumentSchema = documentContentSchema.extend({
  identity: identitySchema,
});

export type SharedDocumentContent = z.infer<typeof sharedDocumentSchema>;

export const initialSharedDocumentContent = ({
  content,
  branch,
  documentId,
}: SharedDocumentIdentity & { content: string }): SharedDocumentContent => ({
  ...initialDocumentContent(content),
  identity: { branch, documentId },
});

export const readSharedDocumentIdentity = (
  handle: DocHandle<DocumentContent>
): Effect.Effect<SharedDocumentIdentity, ValidationError> =>
  Effect.try({
    try: () => {
      const { identity } = sharedDocumentSchema.parse(handle.doc());

      return {
        branch: parseBranch(identity.branch),
        documentId: parseArtifactId(identity.documentId),
      };
    },
    catch: mapErrorTo(
      ValidationError,
      'The share does not say which document it belongs to.'
    ),
  });
