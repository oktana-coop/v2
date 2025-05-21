export type SerializableError = {
  message: string;
  tag: string;
};

export type IPCResult<A> =
  | {
      result: A;
    }
  | { error: SerializableError };

export const isErrorResult = <A>(
  result: IPCResult<A>
): result is { error: SerializableError } => {
  return 'error' in result;
};
