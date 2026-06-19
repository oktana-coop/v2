import { type ProjectRelPath } from './project-rel-path';

// An asset a document references, materialized with its bytes:
// the project-relative path the asset lives at, plus its content.
export type ReferencedAsset = {
  relPath: ProjectRelPath;
  bytes: Uint8Array;
};
