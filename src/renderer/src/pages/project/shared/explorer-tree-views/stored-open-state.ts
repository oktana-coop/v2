import { z } from 'zod';

import { type ProjectId } from '../../../../../../modules/domain/project';
import { type ExplorerOpenState } from './tree/types';

const openStateSchema: z.ZodType<ExplorerOpenState> = z.record(
  z.string(),
  z.boolean()
);

const storageKey = (projectId: ProjectId) => `explorer.openState.${projectId}`;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const readStoredOpenState = (
  projectId: ProjectId
): ExplorerOpenState => {
  const stored = localStorage.getItem(storageKey(projectId));
  const parsed = openStateSchema.safeParse(
    stored === null ? null : parseJson(stored)
  );

  return parsed.success ? parsed.data : {};
};

export const storeOpenState = ({
  projectId,
  openState,
}: {
  projectId: ProjectId;
  openState: ExplorerOpenState;
}) => localStorage.setItem(storageKey(projectId), JSON.stringify(openState));
