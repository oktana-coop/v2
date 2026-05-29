import { describe, expect, it } from 'vitest';

import { parseAssetDocRelPath } from '../../rich-text/models';
import { docRelToProjectRel, projectRelToDocRel } from './document-asset-paths';
import { parseProjectRelPath } from './project-rel-path';

describe('projectRelToDocRel', () => {
  it('returns the path unchanged for a doc at the project root', () => {
    expect(
      projectRelToDocRel({
        projectRel: parseProjectRelPath('assets/a.jpg'),
        docPath: parseProjectRelPath('notes.md'),
      })
    ).toBe('assets/a.jpg');
  });

  it('walks up one level for a doc one folder deep', () => {
    expect(
      projectRelToDocRel({
        projectRel: parseProjectRelPath('assets/a.jpg'),
        docPath: parseProjectRelPath('docs/notes.md'),
      })
    ).toBe('../assets/a.jpg');
  });

  it('walks up several levels for a deeply-nested doc', () => {
    expect(
      projectRelToDocRel({
        projectRel: parseProjectRelPath('assets/a.jpg'),
        docPath: parseProjectRelPath('docs/2024/q1/notes.md'),
      })
    ).toBe('../../../assets/a.jpg');
  });

  it('keeps a shared prefix as-is', () => {
    expect(
      projectRelToDocRel({
        projectRel: parseProjectRelPath('docs/2024/img.jpg'),
        docPath: parseProjectRelPath('docs/2024/notes.md'),
      })
    ).toBe('img.jpg');
  });

  it('handles partial shared prefix', () => {
    expect(
      projectRelToDocRel({
        projectRel: parseProjectRelPath('docs/2024/img.jpg'),
        docPath: parseProjectRelPath('docs/2025/notes.md'),
      })
    ).toBe('../2024/img.jpg');
  });

  it('returns "." when target equals the doc directory', () => {
    expect(
      projectRelToDocRel({
        projectRel: parseProjectRelPath('docs'),
        docPath: parseProjectRelPath('docs/notes.md'),
      })
    ).toBe('.');
  });
});

describe('docRelToProjectRel', () => {
  it('is the inverse for a root-level doc', () => {
    expect(
      docRelToProjectRel({
        docRel: parseAssetDocRelPath('assets/a.jpg'),
        docPath: parseProjectRelPath('notes.md'),
      })
    ).toBe('assets/a.jpg');
  });

  it('resolves "../" against the doc directory', () => {
    expect(
      docRelToProjectRel({
        docRel: parseAssetDocRelPath('../assets/a.jpg'),
        docPath: parseProjectRelPath('docs/notes.md'),
      })
    ).toBe('assets/a.jpg');
  });

  it('handles deeply-nested docs', () => {
    expect(
      docRelToProjectRel({
        docRel: parseAssetDocRelPath('../../../assets/a.jpg'),
        docPath: parseProjectRelPath('docs/2024/q1/notes.md'),
      })
    ).toBe('assets/a.jpg');
  });

  it('handles same-folder references', () => {
    expect(
      docRelToProjectRel({
        docRel: parseAssetDocRelPath('img.jpg'),
        docPath: parseProjectRelPath('docs/2024/notes.md'),
      })
    ).toBe('docs/2024/img.jpg');
  });

  it('is the inverse of projectRelToDocRel', () => {
    const cases = [
      { projectRel: 'assets/a.jpg', doc: 'notes.md' },
      { projectRel: 'assets/a.jpg', doc: 'docs/notes.md' },
      { projectRel: 'assets/a.jpg', doc: 'docs/2024/q1/notes.md' },
      { projectRel: 'docs/2024/img.jpg', doc: 'docs/2025/notes.md' },
    ];
    for (const { projectRel, doc } of cases) {
      const projectRelBranded = parseProjectRelPath(projectRel);
      const docBranded = parseProjectRelPath(doc);
      expect(
        docRelToProjectRel({
          docRel: projectRelToDocRel({
            projectRel: projectRelBranded,
            docPath: docBranded,
          }),
          docPath: docBranded,
        })
      ).toBe(projectRelBranded);
    }
  });
});
