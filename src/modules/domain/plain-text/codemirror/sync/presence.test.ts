import {
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { useFakeTimersInTest } from '../../../../../utils/test-utils';
import { parseUsername } from '../../../../auth';
import {
  type ConvergentDocumentVersion,
  type RemotePresence,
} from '../../../collaboration';
import { type ParticipantSelection } from '../../models';
import { type LiveSyncState } from './live-sync';
import { getPresenceDecorations, presence } from './presence';

// Stands in for live sync: tests set the version shown and the local edits
// pending through an effect.
const setSyncState = StateEffect.define<LiveSyncState>();

const fakeSyncField = (initial: LiveSyncState) =>
  StateField.define<LiveSyncState>({
    create: () => initial,
    update: (current, tr) =>
      tr.effects.reduce(
        (state, effect) => (effect.is(setSyncState) ? effect.value : state),
        current
      ),
  });

const selectionAt = ({
  anchor,
  head = anchor,
  version,
}: {
  anchor: number;
  head?: number;
  version: ConvergentDocumentVersion;
}): ParticipantSelection => ({ anchor, head, version });

const peerWithoutSelection = (
  name: string
): RemotePresence<ParticipantSelection> => ({
  peerId: name.toLowerCase(),
  participant: { name: parseUsername(name), email: null, avatarUrl: null },
  selection: null,
});

const peerAt = ({
  name,
  anchor,
  head,
  version,
}: {
  name: string;
  anchor: number;
  head?: number;
  version: ConvergentDocumentVersion;
}): RemotePresence<ParticipantSelection> => ({
  ...peerWithoutSelection(name),
  selection: selectionAt({ anchor, head, version }),
});

const setUpEditor = async () => {
  const peers = await Effect.runPromise(
    SubscriptionRef.make<ReadonlyArray<RemotePresence<ParticipantSelection>>>(
      []
    )
  );
  const publish = vi.fn<(selection: ParticipantSelection | null) => void>();
  const syncField = fakeSyncField({
    baseVersion: 'v1',
    hasPendingLocalEdits: false,
  });

  const view = new EditorView({
    state: EditorState.create({
      doc: 'hello world',
      extensions: [
        syncField,
        presence({
          peers,
          readSyncState: (state) => state.field(syncField),
          publish,
          colorClassFor: (participant) => `color-${participant.name}`,
          selectionColorClassFor: (participant) =>
            `selection-${participant.name}`,
        }),
      ],
    }),
    parent: document.body,
  });
  onTestFinished(() => {
    view.destroy();
  });

  // The peer list reaches the editor asynchronously.
  await vi.runAllTimersAsync();

  // Each drawn caret's position and each highlighted selection's range.
  const drawn = () => {
    const carets: number[] = [];
    const selections: Array<{ from: number; to: number; class: string }> = [];
    getPresenceDecorations(view).between(
      0,
      view.state.doc.length,
      (from, to, decoration) => {
        if (decoration.spec.widget) carets.push(from);
        else selections.push({ from, to, class: decoration.spec.class });
      }
    );

    return { carets, selections };
  };

  return {
    view,
    publish,
    setPeers: async (list: RemotePresence<ParticipantSelection>[]) => {
      await Effect.runPromise(SubscriptionRef.set(peers, list));
      await vi.runAllTimersAsync();
    },
    setSyncState: (next: LiveSyncState) => {
      view.dispatch({ effects: setSyncState.of(next) });
    },
    select: ({ anchor, head = anchor }: { anchor: number; head?: number }) => {
      view.dispatch({ selection: EditorSelection.single(anchor, head) });
    },
    focus: async () => {
      view.focus();
      await vi.runAllTimersAsync();
    },
    blur: async () => {
      view.contentDOM.blur();
      await vi.runAllTimersAsync();
    },
    carets: () => drawn().carets,
    selections: () => drawn().selections,
    caretLabels: () =>
      Array.from(
        view.dom.querySelectorAll('[data-testid="presence-caret"] [data-name]')
      ).map((label) => label.getAttribute('data-name')),
  };
};

describe('presence', () => {
  beforeEach(useFakeTimersInTest);

  describe('publishing the local selection', () => {
    it('publishes the selection at the version shown, once focused', async () => {
      const { publish, select, focus } = await setUpEditor();

      await focus();
      select({ anchor: 3, head: 5 });

      expect(publish).toHaveBeenLastCalledWith(
        selectionAt({ anchor: 3, head: 5, version: 'v1' })
      );
    });

    it('does not publish a selection it already published', async () => {
      const { publish, select, focus, setSyncState } = await setUpEditor();
      await focus();
      select({ anchor: 3 });
      publish.mockClear();

      setSyncState({ baseVersion: 'v1', hasPendingLocalEdits: false });
      select({ anchor: 3 });

      expect(publish).not.toHaveBeenCalled();
    });

    it('holds the selection back while local edits are pending, then publishes it at their version', async () => {
      const { publish, select, focus, setSyncState } = await setUpEditor();
      await focus();
      select({ anchor: 3 });
      publish.mockClear();

      setSyncState({ baseVersion: 'v1', hasPendingLocalEdits: true });
      select({ anchor: 4 });
      expect(publish).not.toHaveBeenCalled();

      setSyncState({ baseVersion: 'v2', hasPendingLocalEdits: false });
      expect(publish).toHaveBeenLastCalledWith(
        selectionAt({ anchor: 4, version: 'v2' })
      );
    });

    it('publishes nothing while unfocused', async () => {
      const { publish, select } = await setUpEditor();

      select({ anchor: 3 });

      expect(publish).not.toHaveBeenCalled();
    });

    it('withdraws the selection on blur', async () => {
      const { publish, focus, blur } = await setUpEditor();
      await focus();

      await blur();

      expect(publish).toHaveBeenLastCalledWith(null);
    });
  });

  describe("peers' carets and selections", () => {
    it('draws a caret for a selection made in the version shown', async () => {
      const { view, setPeers, carets, caretLabels } = await setUpEditor();

      await setPeers([peerAt({ name: 'Bob', anchor: 3, version: 'v1' })]);

      expect(carets()).toEqual([3]);
      expect(caretLabels()).toEqual(['Bob']);
      expect(view.contentDOM.textContent).toBe('hello world');
    });

    it("highlights a peer's selected text in their colour, with their caret at its head", async () => {
      const { setPeers, carets, selections } = await setUpEditor();

      await setPeers([
        peerAt({ name: 'Bob', anchor: 6, head: 2, version: 'v1' }),
      ]);

      expect(selections()).toEqual([
        { from: 2, to: 6, class: 'selection-Bob' },
      ]);
      expect(carets()).toEqual([2]);
    });

    it('highlights nothing for a caret alone', async () => {
      const { setPeers, selections } = await setUpEditor();

      await setPeers([peerAt({ name: 'Bob', anchor: 3, version: 'v1' })]);

      expect(selections()).toEqual([]);
    });

    it('waits for the version a selection was made in before drawing it', async () => {
      const { setPeers, setSyncState, carets } = await setUpEditor();

      await setPeers([peerAt({ name: 'Bob', anchor: 3, version: 'v2' })]);
      expect(carets()).toEqual([]);

      setSyncState({ baseVersion: 'v2', hasPendingLocalEdits: false });
      expect(carets()).toEqual([3]);
    });

    it('keeps what is drawn while the next selection waits for its version', async () => {
      const { setPeers, setSyncState, carets, selections } =
        await setUpEditor();
      await setPeers([
        peerAt({ name: 'Bob', anchor: 1, head: 3, version: 'v1' }),
      ]);

      await setPeers([peerAt({ name: 'Bob', anchor: 5, version: 'v2' })]);
      expect(carets()).toEqual([3]);
      expect(selections()).toEqual([
        { from: 1, to: 3, class: 'selection-Bob' },
      ]);

      setSyncState({ baseVersion: 'v2', hasPendingLocalEdits: false });
      expect(carets()).toEqual([5]);
      expect(selections()).toEqual([]);
    });

    it('removes what is drawn when its peer leaves or has no selection', async () => {
      const { setPeers, carets, selections } = await setUpEditor();
      await setPeers([
        peerAt({ name: 'Bob', anchor: 1, head: 3, version: 'v1' }),
        peerAt({ name: 'Carol', anchor: 4, version: 'v1' }),
      ]);
      expect(carets()).toEqual([3, 4]);

      await setPeers([
        peerWithoutSelection('Bob'),
        peerAt({ name: 'Carol', anchor: 4, version: 'v1' }),
      ]);
      expect(carets()).toEqual([4]);
      expect(selections()).toEqual([]);

      await setPeers([]);
      expect(carets()).toEqual([]);
    });

    it('draws a selection beyond the text at its end', async () => {
      const { view, setPeers, carets } = await setUpEditor();

      await setPeers([peerAt({ name: 'Bob', anchor: 999, version: 'v1' })]);

      expect(carets()).toEqual([view.state.doc.length]);
    });

    describe('through edits', () => {
      it('moves a caret and a selection along with the edits before them', async () => {
        const { view, setPeers, carets, selections } = await setUpEditor();
        await setPeers([
          peerAt({ name: 'Bob', anchor: 6, head: 8, version: 'v1' }),
        ]);

        view.dispatch({ changes: { from: 1, insert: 'XX' } });

        expect(carets()).toEqual([10]);
        expect(selections()).toEqual([
          { from: 8, to: 10, class: 'selection-Bob' },
        ]);
      });

      // A peer's caret follows their typing, so text inserted at it goes
      // before it, even while their next selection waits.
      it('moves a caret past text inserted at it', async () => {
        const { view, setPeers, setSyncState, carets } = await setUpEditor();
        await setPeers([peerAt({ name: 'Bob', anchor: 6, version: 'v1' })]);
        await setPeers([peerAt({ name: 'Bob', anchor: 8, version: 'v2' })]);

        // The peer's text arrives under a version that is not theirs.
        view.dispatch({ changes: { from: 6, insert: 'XX' } });
        setSyncState({ baseVersion: 'v3', hasPendingLocalEdits: false });

        expect(carets()).toEqual([8]);
      });
    });
  });
});
