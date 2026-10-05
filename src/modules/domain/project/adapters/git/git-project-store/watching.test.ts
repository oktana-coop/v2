import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFakeTimersInTest } from '../../../../../../utils/test-utils';
import { type DirectoryWatcher } from '../../../../../infrastructure/filesystem';
import { GIT_DIR_NAME } from '../../../constants';
import { PROJECT_PATH } from './test-utils';
import { createWatchingOps } from './watching';

const unwatchDirectory = vi.fn();
const watchDirectory = vi.fn<DirectoryWatcher['watchDirectory']>(
  () => unwatchDirectory
);
const received = vi.fn();

const { projectContentChangeEvents } = createWatchingOps({
  directoryWatcher: { watchDirectory, unwatchAllDirectories: vi.fn() },
});

// The watcher reporting a change under the watched directory.
const reportChange = () => {
  const [[{ onChange }]] = watchDirectory.mock.calls;
  onChange();
};

// Listens like a consumer would, until stopped.
const listen = ({ emitOnStart }: { emitOnStart: boolean }) =>
  Effect.runFork(
    Stream.runForEach(
      projectContentChangeEvents({ projectId: PROJECT_PATH, emitOnStart }),
      () => Effect.sync(received)
    )
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('projectContentChangeEvents', () => {
  it("watches the project's working tree, leaving out the repository", async () => {
    const listening = listen({ emitOnStart: false });

    await vi.waitFor(() =>
      expect(watchDirectory).toHaveBeenCalledWith(
        expect.objectContaining({
          path: PROJECT_PATH,
          ignoredTopLevelEntries: [GIT_DIR_NAME],
        })
      )
    );
    await Effect.runPromise(Fiber.interrupt(listening));
  });

  it('emits on start when asked to', async () => {
    const listening = listen({ emitOnStart: true });

    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce());
    await Effect.runPromise(Fiber.interrupt(listening));
  });

  it('emits only for changes otherwise', async () => {
    useFakeTimersInTest();
    const listening = listen({ emitOnStart: false });
    await vi.runAllTimersAsync();
    expect(received).not.toHaveBeenCalled();

    reportChange();
    await vi.runAllTimersAsync();

    expect(received).toHaveBeenCalledOnce();
    await Effect.runPromise(Fiber.interrupt(listening));
  });

  it('emits an event for every change the watcher reports', async () => {
    const listening = listen({ emitOnStart: false });
    // Listening starts on its own fiber; wait until it is watching.
    await vi.waitFor(() => expect(watchDirectory).toHaveBeenCalled());

    reportChange();
    reportChange();

    await vi.waitFor(() => expect(received).toHaveBeenCalledTimes(2));
    await Effect.runPromise(Fiber.interrupt(listening));
  });

  it('stops watching once nobody listens', async () => {
    const listening = listen({ emitOnStart: false });
    // Listening starts on its own fiber; wait until it is watching.
    await vi.waitFor(() => expect(watchDirectory).toHaveBeenCalled());

    await Effect.runPromise(Fiber.interrupt(listening));

    expect(unwatchDirectory).toHaveBeenCalledOnce();
  });
});
