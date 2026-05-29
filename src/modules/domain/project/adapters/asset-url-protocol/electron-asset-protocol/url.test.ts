import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { VersionedProjectValidationErrorTag } from '../../../errors';
import { parseProjectId, parseProjectRelPath } from '../../../models';
import { type ParseProjectAssetUrlResult } from '../../../ports/asset-url-protocol';
import { buildProjectAssetUrl, parseProjectAssetUrl } from './url';

const runParse = (url: string) =>
  Effect.runSync(Effect.either(parseProjectAssetUrl(url)));

const expectValidationError = (url: string) => {
  const result = runParse(url);
  expect(result._tag).toBe('Left');
  if (result._tag === 'Left') {
    expect(result.left._tag).toBe(VersionedProjectValidationErrorTag);
  }
};

const expectParsed = (url: string, expected: ParseProjectAssetUrlResult) => {
  const result = runParse(url);
  expect(result._tag).toBe('Right');
  if (result._tag === 'Right') {
    expect(result.right).toEqual(expected);
  }
};

describe('buildProjectAssetUrl', () => {
  it('builds a URL with encoded project id and path segments', () => {
    expect(
      buildProjectAssetUrl({
        projectId: parseProjectId('proj-1'),
        relPath: parseProjectRelPath('assets/foo.png'),
      })
    ).toBe('project-asset://project/proj-1/assets/foo.png');
  });

  it('encodes filesystem-path projectIds (slashes preserved as %2F in path)', () => {
    expect(
      buildProjectAssetUrl({
        projectId: parseProjectId('/Users/aris/proj'),
        relPath: parseProjectRelPath('assets/foo.png'),
      })
    ).toBe('project-asset://project/%2FUsers%2Faris%2Fproj/assets/foo.png');
  });

  it('normalizes Windows-style separators to POSIX', () => {
    expect(
      buildProjectAssetUrl({
        projectId: parseProjectId('proj-1'),
        relPath: parseProjectRelPath('assets\\sub\\foo.png'),
      })
    ).toBe('project-asset://project/proj-1/assets/sub/foo.png');
  });

  it('percent-encodes spaces and special characters per segment', () => {
    expect(
      buildProjectAssetUrl({
        projectId: parseProjectId('proj 1'),
        relPath: parseProjectRelPath('assets/my image.png'),
      })
    ).toBe('project-asset://project/proj%201/assets/my%20image.png');
  });
});

describe('parseProjectAssetUrl', () => {
  it('parses a well-formed URL', () => {
    expectParsed('project-asset://project/proj-1/assets/foo.png', {
      projectId: parseProjectId('proj-1'),
      relPath: parseProjectRelPath('assets/foo.png'),
    });
  });

  it('decodes percent-encoded segments', () => {
    expectParsed('project-asset://project/proj%201/assets/my%20image.png', {
      projectId: parseProjectId('proj 1'),
      relPath: parseProjectRelPath('assets/my image.png'),
    });
  });

  it('decodes filesystem-path projectIds', () => {
    expectParsed(
      'project-asset://project/%2FUsers%2Faris%2Fproj/assets/foo.png',
      {
        projectId: parseProjectId('/Users/aris/proj'),
        relPath: parseProjectRelPath('assets/foo.png'),
      }
    );
  });

  it('fails with ValidationError for non-matching scheme', () => {
    expectValidationError('https://project/proj-1/assets/foo.png');
  });

  it('fails with ValidationError for non-matching host', () => {
    expectValidationError('project-asset://elsewhere/proj-1/assets/foo.png');
  });

  it('fails with ValidationError for malformed input', () => {
    expectValidationError('not a url');
  });

  it('fails with ValidationError when projectId or path is missing', () => {
    expectValidationError('project-asset://project/proj-1');
    expectValidationError('project-asset://project/');
  });
});
