import { type RichTextDocument } from '../../../../../modules/domain/rich-text';
import {
  type ArtifactHistoryInfo,
  type VersionControlId,
} from '../../../../../modules/infrastructure/version-control';
import { type Message } from '../../../../../utils/web-worker/types';

export type SetupMessage = Message<{ projectId: VersionControlId }> & {
  type: 'setup';
};

export type TerminateMessage = Message & {
  type: 'terminate';
};

export type LoadHistoryMessage = Message<{
  documentId: VersionControlId;
}> & {
  type: 'loadHistory';
};

export type HistoryInfo = ArtifactHistoryInfo<RichTextDocument>;

export type VersionControlWebWorkerMessage =
  | SetupMessage
  | TerminateMessage
  | LoadHistoryMessage;

export const isSetupMessage = (
  message: VersionControlWebWorkerMessage
): message is SetupMessage => message.type === 'setup';

export const isTerminateMessage = (
  message: VersionControlWebWorkerMessage
): message is TerminateMessage => message.type === 'terminate';

export const isLoadHistoryMessage = (
  message: VersionControlWebWorkerMessage
): message is LoadHistoryMessage => message.type === 'loadHistory';
