import { z } from 'zod';

const projectFsPathSchema = z.string().min(1).max(255).brand('projectFsPath');

export type ProjectFsPath = z.infer<typeof projectFsPathSchema>;

export const projectIdSchema = projectFsPathSchema;

export type ProjectId = z.infer<typeof projectIdSchema>;

export const isValidProjectId = (val: unknown): val is ProjectId => {
  return projectIdSchema.safeParse(val).success;
};

export const parseProjectFsPath = (path: string) =>
  projectFsPathSchema.parse(path);

export const parseProjectId = (input: string) => projectIdSchema.parse(input);

export const urlEncodeProjectId = (id: ProjectId) => encodeURIComponent(id);

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
