import * as Effect from 'effect/Effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type DocumentAssetSrc,
  parseDocumentAssetSrc,
} from '../../rich-text/models';
import {
  parseProjectId,
  parseProjectRelPath,
  type ProjectId,
  type ProjectRelPath,
} from '../models';
import { resolveDocumentAssetUrl } from './resolve-document-asset-url';

const buildProjectAssetUrl = vi
  .fn()
  .mockImplementation(
    ({ projectId, relPath }: { projectId: ProjectId; relPath: string }) =>
      Effect.succeed(`project-asset://project/${projectId}/${relPath}`)
  );

const runCommand = (args: {
  src: DocumentAssetSrc;
  docPath: ProjectRelPath;
  projectId: ProjectId;
}) => Effect.runSync(resolveDocumentAssetUrl({ buildProjectAssetUrl })(args));

describe('resolveDocumentAssetUrl', () => {
  beforeEach(() => {
    buildProjectAssetUrl.mockClear();
  });

  it('passes through absolute URLs unchanged without calling buildProjectAssetUrl', () => {
    expect(
      runCommand({
        src: parseDocumentAssetSrc('https://example.com/a.jpg'),
        docPath: parseProjectRelPath('docs/notes.md'),
        projectId: parseProjectId('proj-1'),
      })
    ).toBe('https://example.com/a.jpg');
    expect(buildProjectAssetUrl).not.toHaveBeenCalled();
  });

  it('lifts doc-relative paths to project-relative before resolving', () => {
    expect(
      runCommand({
        src: parseDocumentAssetSrc('../assets/a.jpg'),
        docPath: parseProjectRelPath('docs/notes.md'),
        projectId: parseProjectId('proj-1'),
      })
    ).toBe('project-asset://project/proj-1/assets/a.jpg');
  });

  it('passes root-level docs through without ".." prefixes', () => {
    expect(
      runCommand({
        src: parseDocumentAssetSrc('assets/a.jpg'),
        docPath: parseProjectRelPath('notes.md'),
        projectId: parseProjectId('proj-1'),
      })
    ).toBe('project-asset://project/proj-1/assets/a.jpg');
  });
});
