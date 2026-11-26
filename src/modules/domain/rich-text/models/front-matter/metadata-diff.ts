import * as Either from 'effect/Either';
import { z } from 'zod';

import { ValidationError } from '../../errors';

export type NodeOp = 'insert' | 'delete' | 'copy';

export type MetadataKeyDiff = {
  op: NodeOp;
  key: string;
  values: MetadataValueDiff[];
};

export type MetadataValueDiff =
  | { op: NodeOp; type: 'MetaMap'; entries: MetadataKeyDiff[] }
  | { op: NodeOp; type: 'MetaList'; items: MetadataValueDiff[] }
  | { op: NodeOp; type: 'MetaBool'; value: boolean }
  | { op: NodeOp; type: 'MetaString'; value: string }
  | { op: NodeOp; type: 'MetaInlines' | 'MetaBlocks'; hasChanges: boolean }
  | { type: 'MetaBoolDiff'; before: boolean; after: boolean }
  | { type: 'MetaStringDiff'; before: string; after: string };

const nodeOpSchema = z.enum(['insert', 'delete', 'copy']);

const metadataKeyDiffSchema: z.ZodType<MetadataKeyDiff> = z.lazy(() =>
  z.object({
    op: nodeOpSchema,
    key: z.string(),
    values: z.array(metadataValueDiffSchema),
  })
);

const metadataValueDiffSchema: z.ZodType<MetadataValueDiff> = z.lazy(() =>
  z.union([
    z.object({
      op: nodeOpSchema,
      type: z.literal('MetaMap'),
      entries: z.array(metadataKeyDiffSchema),
    }),
    z.object({
      op: nodeOpSchema,
      type: z.literal('MetaList'),
      items: z.array(metadataValueDiffSchema),
    }),
    z.object({
      op: nodeOpSchema,
      type: z.literal('MetaBool'),
      value: z.boolean(),
    }),
    z.object({
      op: nodeOpSchema,
      type: z.literal('MetaString'),
      value: z.string(),
    }),
    z.object({
      op: nodeOpSchema,
      type: z.enum(['MetaInlines', 'MetaBlocks']),
      hasChanges: z.boolean(),
    }),
    z.object({
      type: z.literal('MetaBoolDiff'),
      before: z.boolean(),
      after: z.boolean(),
    }),
    z.object({
      type: z.literal('MetaStringDiff'),
      before: z.string(),
      after: z.string(),
    }),
  ])
);

const metadataDiffSchema = z.array(metadataKeyDiffSchema);

export const parseMetadataDiff = (
  value: unknown
): Either.Either<MetadataKeyDiff[], ValidationError> => {
  const result = metadataDiffSchema.safeParse(value);

  return result.success
    ? Either.right(result.data)
    : Either.left(
        new ValidationError(
          `Invalid metadata diff: ${z.prettifyError(result.error)}`
        )
      );
};

const valueHasChanges = (diff: MetadataValueDiff): boolean => {
  switch (diff.type) {
    case 'MetaBoolDiff':
    case 'MetaStringDiff':
      return true;
    case 'MetaMap':
      return diff.op !== 'copy' || diff.entries.some(hasChanges);
    case 'MetaList':
      return diff.op !== 'copy' || diff.items.some(valueHasChanges);
    case 'MetaBool':
    case 'MetaString':
      return diff.op !== 'copy';
    case 'MetaInlines':
    case 'MetaBlocks':
      return diff.hasChanges;
  }
};

// Whether the node or anything below it changed.
export const hasChanges = (
  diff: MetadataKeyDiff | MetadataValueDiff
): boolean =>
  'key' in diff
    ? diff.op !== 'copy' || diff.values.some(hasChanges)
    : valueHasChanges(diff);
