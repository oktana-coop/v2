import {
  type FailureResult,
  isSuccessResult,
  type Message,
  type SuccessResult,
  type WorkerClient,
} from './types';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

export const createWorkerClient = (workerScript: string): WorkerClient => {
  const worker = new Worker(new URL(workerScript, import.meta.url), {
    type: 'module',
  });
  let messageId = 0;
  const pending = new Map<number, PendingRequest>();

  worker.onmessage = (
    ev: MessageEvent<SuccessResult<unknown> | FailureResult>
  ) => {
    const result = ev.data;
    const entry = pending.get(result.messageId);
    if (!entry) return;
    pending.delete(result.messageId);

    if (isSuccessResult(result)) {
      entry.resolve(result.data);
    } else {
      entry.reject(new Error(result.errorMessage));
    }
  };

  return {
    send<MessageData, ResultData>(type: string, data?: MessageData) {
      const id = ++messageId;
      const message: Message<MessageData | undefined> = { id, type, data };

      return new Promise<ResultData>((resolve, reject) => {
        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject: reject as (err: unknown) => void,
        });

        worker.postMessage(message);
      });
    },

    terminate() {
      pending.forEach(({ reject }) =>
        reject(new Error('Worker terminated before response'))
      );
      pending.clear();

      worker.terminate();
    },
  };
};
