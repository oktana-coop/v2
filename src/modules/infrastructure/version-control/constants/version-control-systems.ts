import type { ValueOf } from 'type-fest';

const AUTOMERGE = 'AUTOMERGE';
const GIT = 'GIT';

export const versionControlSystems = {
  AUTOMERGE,
  GIT,
} as const;

export type VersionControlSystem = ValueOf<typeof versionControlSystems>;
