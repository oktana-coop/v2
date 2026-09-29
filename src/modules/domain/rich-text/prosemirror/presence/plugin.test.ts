import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { useFakeTimersInTest } from '../../../../../utils/test-utils';
import { parseUsername } from '../../../../auth';
import {
  type ConvergentDocumentVersion,
  type ParticipantSelection,
  type RemotePresence,
} from '../../models';
import { schema } from '../schema';
import { type LiveSyncState } from '../sync/live-sync-plugin';
import { doc, para } from '../test-utils';
import { getPresencePluginState, presencePlugin } from './plugin';

// Stands in for the live sync plugin: tests set the version shown and the
// local edits pending through a meta.
const syncKey = new PluginKey<LiveSyncState>('fake-live-sync');

const fakeSyncPlugin = (initial: LiveSyncState) =>
  new Plugin<LiveSyncState>({
    key: syncKey,
    state: {
      init: () => initial,
      apply: (tr, current) => tr.getMeta(syncKey) ?? current,
    },
  });

const selectionAt = ({
  position,
  version,
}: {
  position: number;
  version: ConvergentDocumentVersion;
}): ParticipantSelection => ({ anchor: position, head: position, version });

const peerWithoutSelection = (name: string): RemotePresence => ({
  peerId: name.toLowerCase(),
  participant: { name: parseUsername(name), email: null, avatarUrl: null },
  selection: null,
});

const peerAt = ({
  name,
  position,
  version,
}: {
  name: string;
  position: number;
  version: ConvergentDocumentVersion;
}): RemotePresence => ({
  ...peerWithoutSelection(name),
  selection: selectionAt({ position, version }),
});

const setUpEditor = async () => {
  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>([])
  );
  const publish = vi.fn<(selection: ParticipantSelection | null) => void>();

  const state = EditorState.create({
    schema,
    doc: doc([para('hello world')]),
    plugins: [
      fakeSyncPlugin({ baseVersion: 'v1', hasPendingLocalEdits: false }),
      presencePlugin({
        peers,
        readSyncState: (editorState) =>
          syncKey.getState(editorState) as LiveSyncState,
        publish,
        colorClassFor: (participant) => `color-${participant.name}`,
      }),
    ],
  });

  const view: EditorView = new EditorView(document.createElement('div'), {
    state,
    dispatchTransaction: (tr) => {
      view.updateState(view.state.apply(tr));
    },
  });
  // jsdom only focuses what it considers focusable.
  view.dom.setAttribute('tabindex', '0');
  document.body.appendChild(view.dom);
  onTestFinished(() => {
    view.dom.remove();
    view.destroy();
  });

  // The peer list reaches the plugin asynchronously.
  await vi.runAllTimersAsync();

  return {
    view,
    publish,
    setPeers: async (list: RemotePresence[]) => {
      await Effect.runPromise(SubscriptionRef.set(peers, list));
      await vi.runAllTimersAsync();
    },
    setSyncState: (next: LiveSyncState) => {
      view.dispatch(view.state.tr.setMeta(syncKey, next));
    },
    select: (position: number) => {
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(view.state.doc, position)
        )
      );
    },
    carets: () =>
      getPresencePluginState(view.state)
        .decorations.find()
        .map((decoration) => decoration.from),
    caretLabels: () =>
      Array.from(
        view.dom.querySelectorAll('[data-testid="presence-caret"] [data-name]')
      ).map((label) => label.getAttribute('data-name')),
  };
};

describe('presencePlugin', () => {
  beforeEach(useFakeTimersInTest);

  describe('publishing the local selection', () => {
    it('publishes the selection at the version shown, once focused', async () => {
      const { view, publish, select } = await setUpEditor();

      view.focus();
      select(3);

      expect(publish).toHaveBeenLastCalledWith(
        selectionAt({ position: 3, version: 'v1' })
      );
    });

    it('does not publish a selection it already published', async () => {
      const { view, publish, select, setSyncState } = await setUpEditor();
      view.focus();
      select(3);
      publish.mockClear();

      setSyncState({ baseVersion: 'v1', hasPendingLocalEdits: false });
      select(3);

      expect(publish).not.toHaveBeenCalled();
    });

    it('holds the selection back while local edits are pending, then publishes it at their version', async () => {
      const { view, publish, select, setSyncState } = await setUpEditor();
      view.focus();
      select(3);
      publish.mockClear();

      setSyncState({ baseVersion: 'v1', hasPendingLocalEdits: true });
      select(4);
      expect(publish).not.toHaveBeenCalled();

      setSyncState({ baseVersion: 'v2', hasPendingLocalEdits: false });
      expect(publish).toHaveBeenLastCalledWith(
        selectionAt({ position: 4, version: 'v2' })
      );
    });

    it('publishes nothing while unfocused', async () => {
      const { publish, select } = await setUpEditor();

      select(3);

      expect(publish).not.toHaveBeenCalled();
    });

    it('withdraws the selection on blur', async () => {
      const { view, publish } = await setUpEditor();
      view.focus();

      view.dom.blur();

      expect(publish).toHaveBeenLastCalledWith(null);
    });
  });

  describe("peers' carets", () => {
    it('draws a caret for a selection made in the version shown', async () => {
      const { view, setPeers, carets, caretLabels } = await setUpEditor();

      await setPeers([peerAt({ name: 'Bob', position: 3, version: 'v1' })]);

      expect(carets()).toEqual([3]);
      expect(caretLabels()).toEqual(['Bob']);
      expect(view.dom.textContent).toBe('hello world');
    });

    it('waits for the version a selection was made in before drawing it', async () => {
      const { setPeers, setSyncState, carets } = await setUpEditor();

      await setPeers([peerAt({ name: 'Bob', position: 3, version: 'v2' })]);
      expect(carets()).toEqual([]);

      setSyncState({ baseVersion: 'v2', hasPendingLocalEdits: false });
      expect(carets()).toEqual([3]);
    });

    it('keeps the drawn caret while the next selection waits for its version', async () => {
      const { setPeers, setSyncState, carets } = await setUpEditor();
      await setPeers([peerAt({ name: 'Bob', position: 3, version: 'v1' })]);

      await setPeers([peerAt({ name: 'Bob', position: 5, version: 'v2' })]);
      expect(carets()).toEqual([3]);

      setSyncState({ baseVersion: 'v2', hasPendingLocalEdits: false });
      expect(carets()).toEqual([5]);
    });

    it('removes a caret when its peer leaves or has no selection', async () => {
      const { setPeers, carets } = await setUpEditor();
      await setPeers([
        peerAt({ name: 'Bob', position: 3, version: 'v1' }),
        peerAt({ name: 'Carol', position: 4, version: 'v1' }),
      ]);
      expect(carets()).toEqual([3, 4]);

      await setPeers([
        peerWithoutSelection('Bob'),
        peerAt({ name: 'Carol', position: 4, version: 'v1' }),
      ]);
      expect(carets()).toEqual([4]);

      await setPeers([]);
      expect(carets()).toEqual([]);
    });

    it('draws a selection beyond the document at its end', async () => {
      const { view, setPeers, carets } = await setUpEditor();

      await setPeers([peerAt({ name: 'Bob', position: 999, version: 'v1' })]);

      expect(carets()).toEqual([view.state.doc.content.size]);
    });

    describe('through edits', () => {
      it('moves a caret along with the edits before it', async () => {
        const { view, setPeers, carets } = await setUpEditor();
        await setPeers([peerAt({ name: 'Bob', position: 6, version: 'v1' })]);

        view.dispatch(view.state.tr.insertText('XX', 1));

        expect(carets()).toEqual([8]);
      });

      // A peer's caret follows their typing, so text inserted at it goes
      // before it, even while their next selection waits.
      it('moves a caret past text inserted at it', async () => {
        const { view, setPeers, setSyncState, carets } = await setUpEditor();
        await setPeers([peerAt({ name: 'Bob', position: 6, version: 'v1' })]);
        await setPeers([peerAt({ name: 'Bob', position: 8, version: 'v2' })]);

        // The peer's text arrives under a version that is not theirs.
        view.dispatch(view.state.tr.insertText('XX', 6));
        setSyncState({ baseVersion: 'v3', hasPendingLocalEdits: false });

        expect(carets()).toEqual([8]);
      });
    });
  });
});
