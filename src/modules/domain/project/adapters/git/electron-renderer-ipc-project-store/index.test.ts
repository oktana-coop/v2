import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type ProjectId } from '../../../models';
import { createAdapter } from './index';

type ProjectStoreAPI = Window['projectStoreAPI'];

const projectId = '/projects/one' as ProjectId;

const unsubscribe = vi.fn();
const subscribeToProjectContentChangeEvents = vi.fn<
  ProjectStoreAPI['subscribeToProjectContentChangeEvents']
>(() => unsubscribe);
const received = vi.fn();

const projectStore = createAdapter();

// The preload API delivering an event.
const deliverEvent = () => {
  const [[{ onEvent }]] = subscribeToProjectContentChangeEvents.mock.calls;
  onEvent();
};

// Listens like a consumer would, until stopped.
const listen = () =>
  Effect.runFork(
    Stream.runForEach(
      projectStore.projectContentChangeEvents({
        projectId,
        emitOnStart: true,
      }),
      () => Effect.sync(received)
    )
  );

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window, {
    projectStoreAPI: { subscribeToProjectContentChangeEvents },
  });
});

describe('projectContentChangeEvents', () => {
  it('subscribes through the preload API for the project', async () => {
    const listening = listen();

    await vi.waitFor(() =>
      expect(subscribeToProjectContentChangeEvents).toHaveBeenCalledWith({
        projectId,
        emitOnStart: true,
        onEvent: expect.any(Function),
      })
    );
    await Effect.runPromise(Fiber.interrupt(listening));
  });

  it('emits for every event the preload API delivers', async () => {
    const listening = listen();
    // Listening starts on its own fiber; wait until it has subscribed.
    await vi.waitFor(() =>
      expect(subscribeToProjectContentChangeEvents).toHaveBeenCalled()
    );

    deliverEvent();
    deliverEvent();

    await vi.waitFor(() => expect(received).toHaveBeenCalledTimes(2));
    await Effect.runPromise(Fiber.interrupt(listening));
  });

  it('unsubscribes once nobody listens', async () => {
    const listening = listen();
    // Listening starts on its own fiber; wait until it has subscribed.
    await vi.waitFor(() =>
      expect(subscribeToProjectContentChangeEvents).toHaveBeenCalled()
    );

    await Effect.runPromise(Fiber.interrupt(listening));

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
