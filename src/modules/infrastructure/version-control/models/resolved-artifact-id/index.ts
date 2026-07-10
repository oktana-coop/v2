import { z } from 'zod';

// Opaque, store-defined identifier for a versioned artifact.
export const resolvedArtifactIdSchema = z
  .string()
  .min(1)
  .brand<'ResolvedArtifactId'>();

export type ResolvedArtifactId = z.infer<typeof resolvedArtifactIdSchema>;

export const parseResolvedArtifactId = (input: string) =>
  resolvedArtifactIdSchema.parse(input);

export const isValidResolvedArtifactId = (
  val: unknown
): val is ResolvedArtifactId => {
  return resolvedArtifactIdSchema.safeParse(val).success;
};

export const urlEncodeArtifactId = (id: ResolvedArtifactId) =>
  encodeURIComponent(id);

export const decodeUrlEncodedArtifactId = (
  urlEncodedArtifactId: string
): ResolvedArtifactId | null => {
  try {
    const parsedId = parseResolvedArtifactId(
      decodeURIComponent(urlEncodedArtifactId)
    );
    return parsedId;
  } catch (e) {
    console.error('Failed to decode URL-encoded artifact id:', e);
    return null;
  }
};
