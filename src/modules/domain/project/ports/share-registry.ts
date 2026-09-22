import {
  type ArtifactId,
  type Branch,
} from '../../../../modules/infrastructure/version-control';
import { type ProjectId } from '../models';
import { type ShareId } from './document-sharing';

export type DocumentShareKey = {
  projectId: ProjectId;
  branch: Branch;
  documentId: ArtifactId;
};

export type ShareRegistry = {
  findShareId: (key: DocumentShareKey) => ShareId | null;
  isShared: (key: DocumentShareKey) => boolean;
  rememberShare: (key: DocumentShareKey, shareId: ShareId) => void;
  forgetShare: (key: DocumentShareKey) => void;
};
