import {
  type AutomergeUrl,
  isValidAutomergeUrl,
} from '@automerge/automerge-repo/slim';
import { z } from 'zod';

const projectFsPathSchema = z.string().min(1).max(255).brand('projectFsPath');

export type ProjectFsPath = z.infer<typeof projectFsPathSchema>;

// Automerge URL schema
const automergeUrlSchema = z.custom<AutomergeUrl>(
  (val): val is AutomergeUrl => {
    return typeof val === 'string' && isValidAutomergeUrl(val);
  },
  {
    message: 'Invalid Automerge URL',
  }
);

export const projectIdSchema = z.union([
  automergeUrlSchema,
  projectFsPathSchema,
]);

export type ProjectId = z.infer<typeof projectIdSchema>;

export const isValidProjectId = (val: unknown): val is ProjectId => {
  return projectIdSchema.safeParse(val).success;
};

export const isAutomergeUrl = (id: ProjectId): id is AutomergeUrl => {
  return typeof id === 'string' && isValidAutomergeUrl(id);
};

export const isProjectFsPath = (id: ProjectId): id is ProjectFsPath => {
  return typeof id === 'string' && !isValidAutomergeUrl(id);
};

export const parseProjectFsPath = (path: string) =>
  projectFsPathSchema.parse(path);

export const parseAutomergeUrl = (id: string) => automergeUrlSchema.parse(id);

export const parseProjectId = (input: string) => projectIdSchema.parse(input);

export const urlEncodeProjectId = (id: ProjectId) => {
  if (isAutomergeUrl(id)) {
    return id;
  }

  return encodeURIComponent(id);
};

export const decodeUrlEncodedProjectId = (
  urlEncodedProjectId: string
): ProjectId | null => {
  try {
    const parsedId = parseProjectId(decodeURIComponent(urlEncodedProjectId));
    return parsedId;
  } catch (e) {
    console.error('Failed to decode URL heads:', e);
    return null;
  }
};
