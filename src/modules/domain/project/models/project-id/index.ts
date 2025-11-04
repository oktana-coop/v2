import {
  type AutomergeUrl,
  isValidAutomergeUrl,
} from '@automerge/automerge-repo/slim';
import { z } from 'zod';

const projectPathSchema = z.string().min(1).max(255).brand('dirPath');

export type ProjectDirPath = z.infer<typeof projectPathSchema>;

// Automerge URL schema
const automergeUrlSchema = z.custom<AutomergeUrl>(
  (val): val is AutomergeUrl => {
    return typeof val === 'string' && isValidAutomergeUrl(val);
  },
  {
    message: 'Invalid Automerge URL',
  }
);

export const projectidSchema = z.union([automergeUrlSchema, projectPathSchema]);

export type ProjectId = z.infer<typeof projectidSchema>;

export const isValidProjectId = (val: unknown): val is ProjectId => {
  return projectidSchema.safeParse(val).success;
};

export const isAutomergeUrl = (id: ProjectId): id is AutomergeUrl => {
  return typeof id === 'string' && isValidAutomergeUrl(id);
};

export const isProjectDirPath = (id: ProjectId): id is ProjectDirPath => {
  return typeof id === 'string' && !isValidAutomergeUrl(id);
};

export const parseProjectDirPath = (path: string) =>
  projectPathSchema.parse(path);

export const parseAutomergeUrl = (id: string) => automergeUrlSchema.parse(id);
