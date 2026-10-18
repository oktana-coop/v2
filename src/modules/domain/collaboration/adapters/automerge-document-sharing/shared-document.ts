import { type DocHandle } from '@automerge/automerge-repo/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { z } from 'zod';

import { mapErrorTo } from '../../../../../utils/errors';
import {
  parseArtifactId,
  parseBranch,
} from '../../../../infrastructure/version-control';
import { UnexpectedDocumentKindError, ValidationError } from '../../errors';
import { type SharedDocumentInfo } from '../../ports';

// What kind of document a share holds, as the kind names itself.
const sharedDocumentKindSchema = z.object({
  kind: z.string(),
});

// What a share says about the document it is, next to the kind's content.
const sharedDocumentInfoSchema = z.object({
  identity: z.object({
    branch: z.string(),
    documentId: z.string(),
  }),
  name: z.string().trim().min(1).max(255),
});

export type SharedDocumentInfoContent = z.infer<
  typeof sharedDocumentKindSchema
> &
  z.infer<typeof sharedDocumentInfoSchema>;

export const initialSharedDocumentContent = <ContentType>({
  kind,
  content,
  branch,
  documentId,
  name,
}: SharedDocumentInfo & {
  kind: string;
  content: ContentType;
}): ContentType & SharedDocumentInfoContent => ({
  ...content,
  kind,
  identity: { branch, documentId },
  name,
});

export const readSharedDocumentKind = (
  handle: DocHandle<unknown>
): Effect.Effect<string, ValidationError> => {
  const parsed = sharedDocumentKindSchema.safeParse(handle.fullDoc());

  return parsed.success
    ? Effect.succeed(parsed.data.kind)
    : Effect.fail(
        new ValidationError(
          'The share does not say what kind of document it is.'
        )
      );
};

export const checkSharedDocumentKind = ({
  handle,
  kind,
}: {
  handle: DocHandle<unknown>;
  kind: string;
}): Effect.Effect<void, UnexpectedDocumentKindError | ValidationError> =>
  pipe(
    readSharedDocumentKind(handle),
    Effect.flatMap((sharedKind) =>
      sharedKind === kind
        ? Effect.void
        : Effect.fail(
            new UnexpectedDocumentKindError(
              `The share holds a ${sharedKind} document, not a ${kind} one.`
            )
          )
    )
  );

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
