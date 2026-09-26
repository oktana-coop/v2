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

export type RegisteredShare = {
  key: DocumentShareKey;
  shareId: ShareId;
};

export type ShareRegistry = {
  listShares: () => RegisteredShare[];
  findShareId: (key: DocumentShareKey) => ShareId | null;
  isShared: (key: DocumentShareKey) => boolean;
  rememberShare: (share: RegisteredShare) => void;
  forgetShare: (key: DocumentShareKey) => void;
  subscribe: (listener: () => void) => () => void;
};
