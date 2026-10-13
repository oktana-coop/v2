import { type DocHandle } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../../../utils/errors';
import {
  parseArtifactId,
  parseBranch,
} from '../../../../infrastructure/version-control';
import { ValidationError } from '../../errors';
import { type SharedDocumentInfo } from '../../ports';

// What a share says about the document it is, next to the kind's content.
const sharedDocumentInfoSchema = z.object({
  identity: z.object({
    branch: z.string(),
    documentId: z.string(),
  }),
  name: z.string().trim().min(1).max(255),
});

export type SharedDocumentInfoContent = z.infer<
  typeof sharedDocumentInfoSchema
>;

export const initialSharedDocumentContent = <ContentType>({
  content,
  branch,
  documentId,
  name,
}: SharedDocumentInfo & {
  content: ContentType;
}): ContentType & SharedDocumentInfoContent => ({
  ...content,
  identity: { branch, documentId },
  name,
});

export const readSharedDocumentInfo = (
  handle: DocHandle<unknown>
): Effect.Effect<SharedDocumentInfo, ValidationError> =>
  Effect.try({
    try: () => {
      const { identity, name } = sharedDocumentInfoSchema.parse(
        handle.fullDoc()
      );

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
