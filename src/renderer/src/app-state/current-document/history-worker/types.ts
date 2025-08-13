import { type RichTextDocument } from '../../../../../modules/domain/rich-text';
import { type ArtifactHistoryInfo } from '../../../../../modules/infrastructure/version-control';

export type LoadHistoryMessage = {
  messageId: number;
  documentData: Uint8Array;
};

export type SuccessLoadHistoryResult = {
  messageId: number;
  success: true;
  historyInfo: ArtifactHistoryInfo<RichTextDocument>;
};

export type FailureLoadHistoryResult = {
  messageId: number;
  success: false;
  errorMessage: string;
};

export type LoadHistoryResult =
  | SuccessLoadHistoryResult
  | FailureLoadHistoryResult;

export const isSuccessResult = (
  result: LoadHistoryResult
): result is SuccessLoadHistoryResult => result.success;

export const isFailureResult = (
  result: LoadHistoryResult
): result is FailureLoadHistoryResult => !result.success;
