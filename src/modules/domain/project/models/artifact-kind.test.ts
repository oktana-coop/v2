import { describe, expect, it } from 'vitest';

import { artifactKinds, canReferenceAssets } from './artifact-kind';

describe('canReferenceAssets', () => {
  it('holds for rich-text documents', () => {
    expect(canReferenceAssets(artifactKinds.RICH_TEXT_DOCUMENT)).toBe(true);
  });

  it('does not hold for binary files', () => {
    expect(canReferenceAssets(artifactKinds.BINARY_FILE)).toBe(false);
  });
});
