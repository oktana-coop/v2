import { identity, pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { type Node } from 'prosemirror-model';
import {
  type EditorState,
  Plugin,
  PluginKey,
  type Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

import { subscribeToRef } from '../../../../../utils/effect';
import {
  type ConvergentDocumentVersion,
  type Participant,
  type ParticipantSelection,
  type RemotePresence,
  selectionsAreSame,
} from '../../models';
import { type LiveSyncState } from '../sync/live-sync-plugin';
import { caretElement, placeLabels } from './dom';

const pluginKey = new PluginKey<PresencePluginState>('pm-presence');

export type PresencePluginArgs = {
  peers: SubscriptionRef.SubscriptionRef<ReadonlyArray<RemotePresence>>;
  readSyncState: (state: EditorState) => LiveSyncState;
  publish: (selection: ParticipantSelection | null) => void;
  colorClassFor: (participant: Participant) => string;
};

type PresenceWithSelection = RemotePresence & {
  selection: ParticipantSelection;
};

export type PresencePluginState = {
  // Where each peer last said they are.
  presenceByPeer: ReadonlyMap<string, PresenceWithSelection>;
  // One caret per peer, at the selection the editor could show when it was
  // drawn, following the edits since.
  decorations: DecorationSet;
};

type PresenceMeta = { peers: ReadonlyArray<RemotePresence> };

export const getPresencePluginState = (state: EditorState) =>
  pluginKey.getState(state) as PresencePluginState;

// A position from another document, kept inside this one.
const boundedBy = ({ doc, position }: { doc: Node; position: number }) =>
  Math.max(0, Math.min(position, doc.content.size));

export const presencePlugin = ({
  peers,
  readSyncState,
  publish,
  colorClassFor,
}: PresencePluginArgs) => {
  const participantCaret = (participant: Participant) => {
    const label = participant.name;
    const colorClass = colorClassFor(participant);

    return {
      look: `${label}:${colorClass}`,
      element: () => caretElement({ label, colorClass }),
    };
  };

  const createCaretDecoration = ({
    presence,
    doc,
  }: {
    presence: PresenceWithSelection;
    doc: Node;
  }) => {
    const caret = participantCaret(presence.participant);

    return Decoration.widget(
      boundedBy({ doc, position: presence.selection.head }),
      caret.element,
      {
        key: `presence:${presence.peerId}:${caret.look}`,
        peerId: presence.peerId,
        selection: presence.selection,
        ignoreSelection: true,
      }
    );
  };

  const findCaretDecorationForPeer = ({
    decorations,
    peerId,
  }: {
    decorations: DecorationSet;
    peerId: string;
  }) =>
    decorations.find(undefined, undefined, (spec) => spec.peerId === peerId);

  const isDrawn = ({
    decorations,
    presence,
  }: {
    decorations: DecorationSet;
    presence: PresenceWithSelection;
  }) =>
    findCaretDecorationForPeer({ decorations, peerId: presence.peerId }).some(
      (decoration) =>
        selectionsAreSame(decoration.spec.selection, presence.selection)
    );

  const placeCaret = ({
    decorations,
    presence,
    doc,
  }: {
    decorations: DecorationSet;
    presence: PresenceWithSelection;
    doc: Node;
  }) =>
    decorations
      .remove(
        findCaretDecorationForPeer({ decorations, peerId: presence.peerId })
      )
      .add(doc, [createCaretDecoration({ presence, doc })]);

  // Drawn carets keep their place in the text through every transaction,
  // whether it edits the document or not.
  const followEdits = ({
    previous,
    tr,
  }: {
    previous: PresencePluginState;
    tr: Transaction;
  }): PresencePluginState => ({
    ...previous,
    decorations: previous.decorations.map(tr.mapping, tr.doc),
  });

  // A new peer list: a peer moved, lost focus, joined or left. Records where
  // peers are and removes the carets of those gone.
  const reconcile = ({
    incoming,
    previous,
  }: {
    incoming: ReadonlyArray<RemotePresence>;
    previous: PresencePluginState;
  }): PresencePluginState => {
    const presenceByPeer: PresencePluginState['presenceByPeer'] = new Map(
      incoming.flatMap(({ selection, ...peer }) =>
        selection === null
          ? []
          : [[peer.peerId, { ...peer, selection }] as const]
      )
    );

    const toBeRemoved = [...previous.presenceByPeer.keys()].filter(
      (id) => !presenceByPeer.has(id)
    );

    const decorations = toBeRemoved.reduce(
      (decorations, peerId) =>
        decorations.remove(findCaretDecorationForPeer({ decorations, peerId })),
      // Start from the previous decoration set.
      // This preserves decorations we don't touch.
      previous.decorations
    );

    return { presenceByPeer, decorations };
  };

  const placeDueCarets = ({
    previous,
    doc,
    version,
  }: {
    previous: PresencePluginState;
    doc: Node;
    version: ConvergentDocumentVersion;
  }): PresencePluginState => {
    const due = [...previous.presenceByPeer.values()].filter(
      (presence) =>
        presence.selection.version === version &&
        !isDrawn({ decorations: previous.decorations, presence })
    );

    const decorations = due.reduce(
      (decorations, presence) => placeCaret({ decorations, presence, doc }),
      // Start from the previous decoration set.
      // This preserves decorations we don't touch.
      previous.decorations
    );

    return { ...previous, decorations };
  };

  let published: ParticipantSelection | null = null;

  const publishIfChanged = (selection: ParticipantSelection | null) => {
    if (selectionsAreSame(published, selection)) return;

    published = selection;
    publish(selection);
  };

  // Where we are, for peers.
  const publishSelection = (view: EditorView) => {
    if (view.isDestroyed) return;

    // Unfocused: nothing to show, whatever is in flight.
    if (!view.hasFocus()) return publishIfChanged(null);

    const { baseVersion, hasPendingLocalEdits } = readSyncState(view.state);
    // Local edits pending: the version to stamp is not known yet. The
    // transaction that brings their version brings us back here.
    if (hasPendingLocalEdits) return;

    const { anchor, head } = view.state.selection;
    publishIfChanged({ anchor, head, version: baseVersion });
  };

  return new Plugin<PresencePluginState>({
    key: pluginKey,
    state: {
      init: (): PresencePluginState => ({
        presenceByPeer: new Map<string, PresenceWithSelection>(),
        decorations: DecorationSet.empty,
      }),
      apply(tr, current, oldState, newState) {
        const { baseVersion: version } = readSyncState(newState);
        const versionChanged = version !== readSyncState(oldState).baseVersion;
        const presenceMeta: PresenceMeta | undefined = tr.getMeta(pluginKey);
        const mayHaveSomethingToDraw = Boolean(presenceMeta) || versionChanged;

        return pipe(
          current,
          (previous) => followEdits({ previous, tr }),
          presenceMeta
            ? (previous) =>
                reconcile({ incoming: presenceMeta.peers, previous })
            : identity,
          mayHaveSomethingToDraw
            ? (previous) => placeDueCarets({ previous, doc: tr.doc, version })
            : identity
        );
      },
    },
    props: {
      decorations: (state) => getPresencePluginState(state).decorations,
      handleDOMEvents: {
        focus: (view) => {
          publishSelection(view);
          return false;
        },
        blur: (view) => {
          publishSelection(view);
          return false;
        },
      },
    },
    view(view) {
      const unsubscribe = subscribeToRef(peers, (current) => {
        // Wait until the view is ready: the first delivery comes while it is
        // still being built, and dispatching then is not safe.
        queueMicrotask(() => {
          if (view.isDestroyed) return;
          view.dispatch(view.state.tr.setMeta(pluginKey, { peers: current }));
        });
      });

      publishSelection(view);

      return {
        update(view) {
          publishSelection(view);
          placeLabels(view);
        },
        destroy() {
          unsubscribe();
        },
      };
    },
  });
};
