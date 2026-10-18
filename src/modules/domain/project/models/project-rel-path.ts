import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { mapErrorTo } from '../../../../utils/errors';
import { ValidationError } from '../errors';

// A project-relative path: POSIX-normalized (forward slashes only), non-empty,
// no leading slash, no `..` segments that could escape the project root.
//
// The project module's internal convention is POSIX everywhere — Markdown
// already stores paths this way regardless of OS, Git's object model is POSIX
// on every platform, and URLs are always POSIX.
const projectRelPathSchema = z
  .string()
  .min(1)
  .transform((s) => s.replace(/\\/g, '/'))
  .refine(
    (s) => !s.startsWith('/'),
    'project-relative path must not start with /'
  )
  .refine(
    (s) => !s.split('/').includes('..'),
    'project-relative path must not contain ".."'
  )
  .brand('projectRelPath');

export type ProjectRelPath = z.infer<typeof projectRelPathSchema>;

export const parseProjectRelPath = (s: string) => projectRelPathSchema.parse(s);

export const parseProjectRelPathEffect = (s: string) =>
  Effect.try({
    try: () => parseProjectRelPath(s),
    catch: mapErrorTo(ValidationError, 'Invalid project-relative path'),
  });

export const safeParseProjectRelPath = (s: string) =>
  projectRelPathSchema.safeParse(s);

// True when `filePath` is `directoryPath` itself or nested anywhere beneath it.
// Both are project-relative (POSIX), so a plain `/` separator check is correct.
export const isPathInsideDirectory = ({
  directoryPath,
  filePath,
}: {
  directoryPath: ProjectRelPath;
  filePath: ProjectRelPath;
}): boolean =>
  filePath === directoryPath || filePath.startsWith(`${directoryPath}/`);
