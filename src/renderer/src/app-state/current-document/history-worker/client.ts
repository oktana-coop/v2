import { type RichTextDocument } from '../../../../../modules/domain/rich-text';
import { type ArtifactHistoryInfo } from '../../../../../modules/infrastructure/version-control';
import {
  isSuccessResult,
  type LoadHistoryMessage,
  type LoadHistoryResult,
} from './types';

// Using a web worker because loading history is an expensive operation
const worker = new Worker(new URL('./index.ts', import.meta.url), {
  type: 'module',
});

const workerReady = new Promise<void>((resolve) => {
  const readyHandler = (event: MessageEvent) => {
    if (event.data?.type === 'WORKER_READY') {
      worker.removeEventListener('message', readyHandler);
      resolve();
    }
  };
  worker.addEventListener('message', readyHandler);
});

export const createWorkerClient = () => {
  // Assign a unique ID to each message sent to the worker and include it in the worker's response.
  // This way, the worker's response is matched to the correct promise.
  let messageId = 0; // Unique ID for each message

  return async (
    documentData: Uint8Array
  ): Promise<ArtifactHistoryInfo<RichTextDocument>> => {
    await workerReady;

    return new Promise((resolve, reject) => {
      const currentMessageId = messageId++;

      const handleMessage = (event: MessageEvent) => {
        const result = event.data as LoadHistoryResult;

        if (result.messageId === currentMessageId) {
          worker.removeEventListener('message', handleMessage); // Clean up listener
          if (isSuccessResult(result)) {
            resolve(result.historyInfo);
          } else {
            reject(new Error(result.errorMessage));
          }
        }
      };

      // Listen for messages from the worker
      worker.addEventListener('message', handleMessage);

      const message: LoadHistoryMessage = {
        messageId: currentMessageId,
        documentData,
      };

      // Post a message to the worker to start the WASI CLI execution
      worker.postMessage(message);
    });
  };
};
