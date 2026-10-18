import { z } from 'zod';

// Opaque, store-defined identifier for a versioned artifact.
export const artifactIdSchema = z.string().min(1).brand<'ArtifactId'>();

export type ArtifactId = z.infer<typeof artifactIdSchema>;

export const parseArtifactId = (input: string) => artifactIdSchema.parse(input);

export const urlEncodeArtifactId = (id: ArtifactId) => encodeURIComponent(id);

export const decodeUrlEncodedArtifactId = (
  urlEncodedArtifactId: string
): ArtifactId | null => {
  try {
    const parsedId = parseArtifactId(decodeURIComponent(urlEncodedArtifactId));
    return parsedId;
  } catch (e) {
    console.error('Failed to decode URL-encoded artifact id:', e);
    return null;
  }
};
