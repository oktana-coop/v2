import { afterEach, describe, expect, it, vi } from 'vitest';

const importOverrides = async ({ e2eBuild }: { e2eBuild: boolean }) => {
  vi.stubEnv('VITE_E2E', e2eBuild ? 'true' : '');
  vi.resetModules();
  return import('./e2e-launch-overrides');
};

describe('E2E launch overrides', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('honours the overrides in an E2E build', async () => {
    const { readSyncServiceUrlOverride, readHeadlessWindowOverride } =
      await importOverrides({ e2eBuild: true });

    expect(
      readSyncServiceUrlOverride({
        E2E_SYNC_SERVICE_URL: 'ws://127.0.0.1:4000',
      })
    ).toBe('ws://127.0.0.1:4000');
    expect(readHeadlessWindowOverride(['app', '--headless-window'])).toBe(true);
  });

  it('ignores the overrides in a release build', async () => {
    const { readSyncServiceUrlOverride, readHeadlessWindowOverride } =
      await importOverrides({ e2eBuild: false });

    expect(
      readSyncServiceUrlOverride({
        E2E_SYNC_SERVICE_URL: 'ws://127.0.0.1:4000',
      })
    ).toBeUndefined();
    expect(readHeadlessWindowOverride(['app', '--headless-window'])).toBe(
      false
    );
  });
});
