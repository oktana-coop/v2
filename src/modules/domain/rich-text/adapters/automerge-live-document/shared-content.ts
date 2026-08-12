import { z } from 'zod';

// The layout and editing discipline of a shared document: version 1 holds the
// markdown source in `content`, spliced as text. A peer that does not know a
// version cannot take part in its changes, so unknown versions are refused
// rather than migrated.
export const SHARE_FORMAT_VERSION = 1;

export const sharedContentSchema = z.object({
  shareFormatVersion: z.literal(SHARE_FORMAT_VERSION),
  content: z.string(),
});

export type SharedContent = z.infer<typeof sharedContentSchema>;
