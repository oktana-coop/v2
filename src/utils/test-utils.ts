import { onTestFinished, vi } from 'vitest';

// Fake timers for the rest of the running test, restored when it finishes.
// `vi.runAllTimersAsync()` then lets everything that can still run finish.
export const useFakeTimersInTest = () => {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
};

// A promise the test settles itself, like Promise.withResolvers.
// TODO: use Promise.withResolvers once tsconfig's lib includes ES2024.
export const promiseWithResolvers = <A>() => {
  let resolve: (value: A) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<A>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });

  return { promise, resolve, reject };
};
