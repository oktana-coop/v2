import { describe, expect, it } from 'vitest';

import { buildConfig } from './build';
import { resolveRendererConfig } from './renderer';

describe('resolveRendererConfig', () => {
  it('uses the sync service override when there is one', () => {
    expect(
      resolveRendererConfig({ syncServiceUrl: 'ws://127.0.0.1:4000' })
        .syncServiceUrl
    ).toBe('ws://127.0.0.1:4000');
  });

  it('falls back to the build-configured sync service', () => {
    expect(resolveRendererConfig({}).syncServiceUrl).toBe(
      buildConfig.syncServiceUrl
    );
  });
});
