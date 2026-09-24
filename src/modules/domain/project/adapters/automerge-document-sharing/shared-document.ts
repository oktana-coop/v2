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
import { type SharedDocumentInfo } from '../../ports';

const identitySchema = z.object({
  branch: z.string(),
  documentId: z.string(),
});

const sharedDocumentSchema = documentContentSchema.extend({
  identity: identitySchema,
  name: z.string().trim().min(1).max(255),
});

export type SharedDocumentContent = z.infer<typeof sharedDocumentSchema>;

export const initialSharedDocumentContent = ({
  content,
  branch,
  documentId,
  name,
}: SharedDocumentInfo & { content: string }): SharedDocumentContent => ({
  ...initialDocumentContent(content),
  identity: { branch, documentId },
  name,
});

export const readSharedDocumentInfo = (
  handle: DocHandle<DocumentContent>
): Effect.Effect<SharedDocumentInfo, ValidationError> =>
  Effect.try({
    try: () => {
      const { identity, name } = sharedDocumentSchema.parse(handle.fullDoc());

      return {
        branch: parseBranch(identity.branch),
        documentId: parseArtifactId(identity.documentId),
        name,
      };
    },
    catch: mapErrorTo(
      ValidationError,
      'The share does not say which document it is.'
    ),
  });
