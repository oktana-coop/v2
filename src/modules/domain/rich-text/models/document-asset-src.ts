import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../../utils/errors';
import { ValidationError } from '../errors';

// An asset src that the project module should leave untouched when resolving
// references — anything with a URL scheme (e.g. `https://`, `data:`,
// `project-asset://`). External references encoded in Markdown content.
const absoluteAssetSrcSchema = z
  .string()
  .refine(
    (s) => /^[a-z][a-z0-9+.-]*:/i.test(s),
    'absolute asset src must have a URL scheme'
  )
  .brand('absoluteAssetSrc');

export type AbsoluteAssetSrc = z.infer<typeof absoluteAssetSrcSchema>;

export const isAbsoluteAssetSrc = (src: string): src is AbsoluteAssetSrc =>
  absoluteAssetSrcSchema.safeParse(src).success;

// A path encoded in Markdown that references an asset, expressed relative
// to the document's location. Unlike `ProjectRelPath` (in the project
// module), `..` segments are allowed (that's how a nested doc references a
// sibling folder). Must not be an absolute URL — that case is the disjoint
// `AbsoluteAssetSrc`.
const assetDocRelPathSchema = z
  .string()
  .min(1)
  .transform((s) => s.replace(/\\/g, '/'))
  .refine(
    (s) => !s.startsWith('/'),
    'asset doc-relative path must not start with /'
  )
  .refine(
    (s) => !/^[a-z][a-z0-9+.-]*:/i.test(s),
    'asset doc-relative path must not be an absolute URL'
  )
  .brand('assetDocRelPath');

export type AssetDocRelPath = z.infer<typeof assetDocRelPathSchema>;

export const parseAssetDocRelPath = (s: string) =>
  assetDocRelPathSchema.parse(s);

export const parseAssetDocRelPathEffect = (s: string) =>
  Effect.try({
    try: () => parseAssetDocRelPath(s),
    catch: mapErrorTo(ValidationError, 'Invalid asset doc-relative path'),
  });

export const safeParseAssetDocRelPath = (s: string) =>
  assetDocRelPathSchema.safeParse(s);

// Anything that can appear as the `src` of an asset reference in a Markdown
// document — either an absolute URL (passthrough) or a doc-relative path
// (resolvable against the doc's location). The two are disjoint at runtime:
// `isAbsoluteAssetSrc` discriminates between them.
const documentAssetSrcSchema = z.union([
  absoluteAssetSrcSchema,
  assetDocRelPathSchema,
]);

export type DocumentAssetSrc = z.infer<typeof documentAssetSrcSchema>;

export const parseDocumentAssetSrc = (s: string) =>
  documentAssetSrcSchema.parse(s);

export const parseDocumentAssetSrcEffect = (s: string) =>
  Effect.try({
    try: () => parseDocumentAssetSrc(s),
    catch: mapErrorTo(ValidationError, 'Invalid document asset src'),
  });

export const safeParseDocumentAssetSrc = (s: string) =>
  documentAssetSrcSchema.safeParse(s);
