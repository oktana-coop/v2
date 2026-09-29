// Runtime inputs that only E2E builds honour; release builds compile them out.
const isE2EBuild = import.meta.env.VITE_E2E === 'true';

export const readSyncServiceUrlOverride = (env: {
  E2E_SYNC_SERVICE_URL?: string;
}): string | undefined => (isE2EBuild ? env.E2E_SYNC_SERVICE_URL : undefined);

// An argv flag rather than an env var: the `define` in electron.vite.config.ts
// replaces process.env in the main process with the build-time env.
//
// TODO: drop that `define` so main sees runtime env, then read this from env.
export const readHeadlessWindowOverride = (argv: readonly string[]): boolean =>
  isE2EBuild && argv.includes('--headless-window');
