import {
  getParentPath,
  toPosixSegments,
} from '../../../infrastructure/filesystem';
import {
  type AbsoluteAssetSrc,
  type AssetDocRelPath,
  parseAssetDocRelPath,
} from '../../rich-text/models';
import { parseProjectRelPath, type ProjectRelPath } from './project-rel-path';

// The project's resolved view of an asset reference from a document.
export type ResolvedDocumentAssetSrc = AbsoluteAssetSrc | ProjectRelPath;

// Length of the longest segment-wise common prefix between two POSIX-split
// paths. Returns `a.length` when `a` is a prefix of `b` (or equal).
const commonPrefixLength = (a: string[], b: string[]): number => {
  const firstMismatch = a.findIndex((seg, i) => i >= b.length || seg !== b[i]);
  return firstMismatch === -1 ? a.length : firstMismatch;
};

// Converts a project-relative POSIX path to one that's relative to the
// directory containing `docPath` (also project-relative). Example:
// ({projectRel: `assets/a.jpg`, docPath: `docs/2024/notes.md`}) → `../../assets/a.jpg`.
// ({projectRel: `assets/a.jpg`, docPath: `notes.md`}) → `assets/a.jpg`.
export const projectRelToDocRel = ({
  projectRel,
  docPath,
}: {
  projectRel: ProjectRelPath;
  docPath: ProjectRelPath;
}): AssetDocRelPath => {
  const target = toPosixSegments(projectRel);
  const docDir = toPosixSegments(getParentPath(docPath));
  const shared = commonPrefixLength(target, docDir);
  const ups = docDir.slice(shared).map(() => '..');
  const remaining = target.slice(shared);

  return parseAssetDocRelPath([...ups, ...remaining].join('/') || '.');
};

// Converts a document-relative POSIX path (as it would appear in the
// document's Markdown) back into a project-relative POSIX path. Example:
// ({docRel: `../../assets/a.jpg`, docPath: `docs/2024/notes.md`}) → `assets/a.jpg`.
export const docRelToProjectRel = ({
  docRel,
  docPath,
}: {
  docRel: AssetDocRelPath;
  docPath: ProjectRelPath;
}): ProjectRelPath =>
  parseProjectRelPath(
    toPosixSegments(docRel)
      .reduce(
        (acc, seg) => (seg === '..' ? acc.slice(0, -1) : [...acc, seg]),
        toPosixSegments(getParentPath(docPath))
      )
      .join('/')
  );
