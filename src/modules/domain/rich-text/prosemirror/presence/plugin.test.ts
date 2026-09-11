import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseUsername } from '../../../../auth';
import { type ParticipantSelection, type RemotePresence } from '../../models';
import { schema } from '../schema';
import { type LiveSyncState } from '../sync/live-sync-plugin';
import { getPresencePluginState, presencePlugin } from './plugin';

// Stands in for the live sync plugin: tests set the version shown and the
// typing in flight through a meta.
const syncKey = new PluginKey<LiveSyncState>('fake-live-sync');

const fakeSyncPlugin = (initial: LiveSyncState) =>
  new Plugin<LiveSyncState>({
    key: syncKey,
    state: {
      init: () => initial,
      apply: (tr, current) => tr.getMeta(syncKey) ?? current,
    },
  });

const paragraph = (text: string) =>
  schema.node('doc', null, [
    schema.node('paragraph', null, text ? [schema.text(text)] : []),
  ]);

const peer = (
  name: string,
  selection: ParticipantSelection | null
): RemotePresence => ({
  peerId: name.toLowerCase(),
  participant: { name: parseUsername(name), email: null, avatarUrl: null },
  selection,
});

const at = (head: number, version: string): ParticipantSelection => ({
  anchor: head,
  head,
  version,
});

// The peer list reaches the plugin a microtask later.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const views: EditorView[] = [];

const setup = async ({
  text = 'hello world',
  sync = { baseVersion: 'v1', hasPendingLocalEdits: false },
}: { text?: string; sync?: LiveSyncState } = {}) => {
  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence>>([])
  );
  const publish = vi.fn<(selection: ParticipantSelection | null) => void>();

  const state = EditorState.create({
    schema,
    doc: paragraph(text),
    plugins: [
      fakeSyncPlugin(sync),
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
  views.push(view);

  await tick();

  return {
    view,
    publish,
    setPeers: async (list: RemotePresence[]) => {
      await Effect.runPromise(SubscriptionRef.set(peers, list));
      await tick();
    },
    setSync: (next: LiveSyncState) => {
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
  afterEach(() => {
    views.splice(0).forEach((view) => {
      view.dom.remove();
      view.destroy();
    });
  });

  describe('telling peers where we are', () => {
    it('publishes the selection in the version shown, once focused', async () => {
      const { view, publish, select } = await setup();

      view.focus();
      select(3);

      expect(publish).toHaveBeenLastCalledWith(at(3, 'v1'));
    });

    it('publishes only what changed', async () => {
      const { view, publish, select, setSync } = await setup();
      view.focus();
      select(3);
      publish.mockClear();

      setSync({ baseVersion: 'v1', hasPendingLocalEdits: false });
      select(3);

      expect(publish).not.toHaveBeenCalled();
    });

    it('keeps what it said while typing is in flight, then publishes at the version it resolved to', async () => {
      const { view, publish, select, setSync } = await setup();
      view.focus();
      select(3);
      publish.mockClear();

      setSync({ baseVersion: 'v1', hasPendingLocalEdits: true });
      select(4);
      expect(publish).not.toHaveBeenCalled();

      setSync({ baseVersion: 'v2', hasPendingLocalEdits: false });
      expect(publish).toHaveBeenLastCalledWith(at(4, 'v2'));
    });

    it('publishes nothing while unfocused', async () => {
      const { publish, select } = await setup();

      select(3);

      expect(publish).not.toHaveBeenCalled();
    });

    it('withdraws the selection on blur', async () => {
      const { view, publish } = await setup();
      view.focus();

      view.dom.blur();

      expect(publish).toHaveBeenLastCalledWith(null);
    });
  });

  describe('showing where peers are', () => {
    it('places a caret for a selection made in the version shown', async () => {
      const { view, setPeers, carets, caretLabels } = await setup();

      await setPeers([peer('Bob', at(3, 'v1'))]);

      expect(carets()).toEqual([3]);
      expect(caretLabels()).toEqual(['Bob']);
      expect(view.dom.textContent).toBe('hello world');
    });

    it('waits for the version a selection was made in', async () => {
      const { setPeers, setSync, carets } = await setup();

      await setPeers([peer('Bob', at(3, 'v2'))]);
      expect(carets()).toEqual([]);

      setSync({ baseVersion: 'v2', hasPendingLocalEdits: false });
      expect(carets()).toEqual([3]);
    });

    it('keeps the caret it has while the next selection waits', async () => {
      const { setPeers, setSync, carets } = await setup();
      await setPeers([peer('Bob', at(3, 'v1'))]);

      await setPeers([peer('Bob', at(5, 'v2'))]);
      expect(carets()).toEqual([3]);

      setSync({ baseVersion: 'v2', hasPendingLocalEdits: false });
      expect(carets()).toEqual([5]);
    });

    it('lets a waiting caret ride the text inserted at it', async () => {
      const { view, setPeers, setSync, carets } = await setup();
      await setPeers([peer('Bob', at(6, 'v1'))]);
      await setPeers([peer('Bob', at(8, 'v2'))]);

      // The peer's text arrives under a version that is not theirs.
      view.dispatch(view.state.tr.insertText('XX', 6));
      setSync({ baseVersion: 'v3', hasPendingLocalEdits: false });

      expect(carets()).toEqual([8]);
    });

    it('moves carets along with the edits before them', async () => {
      const { view, setPeers, carets } = await setup();
      await setPeers([peer('Bob', at(6, 'v1'))]);

      view.dispatch(view.state.tr.insertText('XX', 1));

      expect(carets()).toEqual([8]);
    });

    it('takes a caret away when its peer leaves or has no selection', async () => {
      const { setPeers, carets } = await setup();
      await setPeers([peer('Bob', at(3, 'v1')), peer('Carol', at(4, 'v1'))]);
      expect(carets()).toEqual([3, 4]);

      await setPeers([peer('Bob', null), peer('Carol', at(4, 'v1'))]);
      expect(carets()).toEqual([4]);

      await setPeers([]);
      expect(carets()).toEqual([]);
    });

    it('clamps a selection beyond the document', async () => {
      const { view, setPeers, carets } = await setup();

      await setPeers([peer('Bob', at(999, 'v1'))]);

      expect(carets()).toEqual([view.state.doc.content.size]);
    });
  });
});
