export type Message<MessageData = undefined> = {
  id: number;
  type: string;
  data: MessageData;
};

export type SuccessResult<ResultData = undefined> = {
  messageId: number;
  success: true;
  data?: ResultData;
};

export type FailureResult = {
  messageId: number;
  success: false;
  errorMessage: string;
};

export const isSuccessResult = <ResultData>(
  result: SuccessResult<ResultData> | FailureResult
): result is SuccessResult<ResultData> => result.success;

export const isFailureResult = <ResultData>(
  result: SuccessResult<ResultData> | FailureResult
): result is FailureResult => !result.success;

export type WorkerClient = {
  send<MessageData, ResultData>(
    method: string,
    data?: MessageData
  ): Promise<ResultData>;
  terminate(): void;
};
