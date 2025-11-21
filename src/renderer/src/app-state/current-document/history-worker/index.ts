import wasmUrl from '@automerge/automerge/automerge.wasm?url';
import * as Automerge from '@automerge/automerge/slim';

import { type RichTextDocument } from '../../../../../modules/domain/rich-text';
import {
  getArtifactHistory,
  importFromBinary,
} from '../../../../../modules/infrastructure/version-control';
import {
  type FailureLoadHistoryResult,
  type LoadHistoryMessage,
  type SuccessLoadHistoryResult,
} from './types';

await Automerge.initializeWasm(wasmUrl);

self.onmessage = async (event) => {
  const { messageId, documentData } = event.data as LoadHistoryMessage;

  try {
    const doc = importFromBinary<RichTextDocument>(documentData);

    const historyInfo = await getArtifactHistory<RichTextDocument>(doc);

    const result: SuccessLoadHistoryResult = {
      messageId,
      success: true,
      historyInfo,
    };

    // Send the result back to the main thread
    self.postMessage(result);
  } catch (error) {
    const result: FailureLoadHistoryResult = {
      messageId,
      success: false,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Error in getting document history in the worker',
    };

    // Send the error back to the main thread
    self.postMessage(result);
  }
};

self.postMessage({ type: 'WORKER_READY' });
