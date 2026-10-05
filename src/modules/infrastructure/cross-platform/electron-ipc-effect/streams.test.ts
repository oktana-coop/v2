import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { type IpcMain, type IpcRenderer } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serveStreamOverIPC, subscribeToStreamOverIPC } from './streams';

const channel = 'test:values';
const args = { projectId: 'one' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subscribeToStreamOverIPC', () => {
  const postMessage = vi.fn<IpcRenderer['postMessage']>();
  const onEvent = vi.fn();

  // The port the main process receives.
  const portSentToMain = () => {
    const [[, , [port]]] = postMessage.mock.calls as unknown as [
      [string, unknown, [MessagePort]],
    ];
    return port;
  };

  it('sends the arguments and a port over the channel', () => {
    subscribeToStreamOverIPC({
      ipcRenderer: { postMessage },
      channel,
      args,
      onEvent,
    });

    expect(postMessage).toHaveBeenCalledWith(channel, args, [
      expect.anything(),
    ]);
  });

  it('calls onEvent for every value posted to the other port', async () => {
    subscribeToStreamOverIPC({
      ipcRenderer: { postMessage },
      channel,
      args,
      onEvent,
    });

    portSentToMain().postMessage('first');
    portSentToMain().postMessage('second');

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(2));
    expect(onEvent).toHaveBeenNthCalledWith(1, 'first');
    expect(onEvent).toHaveBeenNthCalledWith(2, 'second');
  });

  it('closes the channel when the subscription ends', async () => {
    const unsubscribe = subscribeToStreamOverIPC({
      ipcRenderer: { postMessage },
      channel,
      args,
      onEvent,
    });
    const closed = vi.fn();
    portSentToMain().addEventListener('close', closed);

    unsubscribe();

    await vi.waitFor(() => expect(closed).toHaveBeenCalledOnce());
  });
});

describe('serveStreamOverIPC', () => {
  const on = vi.fn<IpcMain['on']>();
  const port = { postMessage: vi.fn(), on: vi.fn(), start: vi.fn() };

  // A renderer subscribing with these arguments.
  const subscribe = () => {
    const [[, handler]] = on.mock.calls;
    (handler as (event: unknown, args: unknown) => void)(
      { ports: [port] },
      args
    );
  };

  const closePort = () => {
    const [[, handler]] = port.on.mock.calls as [[string, () => void]];
    handler();
  };

  it('posts every value of the stream it serves for the arguments', async () => {
    const streamFor = vi.fn(() => Stream.make('first', 'second'));
    serveStreamOverIPC({ ipcMain: { on }, channel, streamFor });

    subscribe();

    await vi.waitFor(() => expect(port.postMessage).toHaveBeenCalledTimes(2));
    expect(on).toHaveBeenCalledWith(channel, expect.any(Function));
    expect(streamFor).toHaveBeenCalledWith(args);
    expect(port.postMessage).toHaveBeenNthCalledWith(1, 'first');
    expect(port.postMessage).toHaveBeenNthCalledWith(2, 'second');
    expect(port.start).toHaveBeenCalledOnce();
  });

  it('ends the stream when the port closes', async () => {
    const ended = vi.fn();
    const streamFor = () => Stream.async<string>(() => Effect.sync(ended));
    serveStreamOverIPC({ ipcMain: { on }, channel, streamFor });
    subscribe();

    closePort();

    await vi.waitFor(() => expect(ended).toHaveBeenCalledOnce());
  });
});
