import { onTestFinished, vi } from 'vitest';

// Fake timers for the rest of the running test, restored when it finishes.
// `vi.runAllTimersAsync()` then lets everything that can still run finish.
export const useFakeTimersInTest = () => {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
};
