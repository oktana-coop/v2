import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import { type IpcMain, type IpcRenderer } from 'electron';

// Each subscription gets a message channel of its own: closing it ends the
// subscription, and the serving side also learns of it when the page reloads,
// crashes or closes.
export const subscribeToStreamOverIPC = <Args, A>({
  ipcRenderer,
  channel,
  args,
  onEvent,
}: {
  ipcRenderer: Pick<IpcRenderer, 'postMessage'>;
  channel: string;
  args: Args;
  onEvent: (value: A) => void;
}): (() => void) => {
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = ({ data }: MessageEvent<A>) => onEvent(data);
  ipcRenderer.postMessage(channel, args, [port2]);

  return () => port1.close();
};

export const serveStreamOverIPC = <Args, A>({
  ipcMain,
  channel,
  streamFor,
}: {
  ipcMain: Pick<IpcMain, 'on'>;
  channel: string;
  streamFor: (args: Args) => Stream.Stream<A>;
}): void => {
  ipcMain.on(channel, ({ ports: [port] }, args: Args) => {
    const forwarding = Effect.runFork(
      Stream.runForEach(streamFor(args), (value) =>
        Effect.sync(() => port.postMessage(value))
      )
    );

    port.on('close', () => {
      Effect.runFork(Fiber.interrupt(forwarding));
    });
    port.start();
  });
};
