import {
  type EditorState,
  type Extension,
  Facet,
  type Range,
  StateEffect,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import * as SubscriptionRef from 'effect/SubscriptionRef';

import { subscribeToRef } from '../../../../../utils/effect';
import {
  type ConvergentDocumentVersion,
  type Participant,
  type RemotePresence,
} from '../../../collaboration';
import { type ParticipantSelection, selectionsAreSame } from '../../models';
import { type LiveSyncState } from './live-sync';
import { caretElement, placeLabels } from './presence-caret';

export type PresenceArgs = {
  peers: SubscriptionRef.SubscriptionRef<
    ReadonlyArray<RemotePresence<ParticipantSelection>>
  >;
  readSyncState: (state: EditorState) => LiveSyncState;
  publish: (selection: ParticipantSelection | null) => void;
  colorClassFor: (participant: Participant) => string;
  selectionColorClassFor: (participant: Participant) => string;
};

type PresenceWithSelection = RemotePresence<ParticipantSelection> & {
  selection: ParticipantSelection;
};

type PresenceDecorationSpec = {
  peerId: string;
  selection: ParticipantSelection;
};

const presenceConfig = Facet.define<PresenceArgs, PresenceArgs>({
  combine: (values) => values[0],
});

// A new peer list: a peer moved, lost focus, joined or left.
const setPeers =
  StateEffect.define<ReadonlyArray<RemotePresence<ParticipantSelection>>>();

class CaretWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly colorClass: string
  ) {
    super();
  }

  eq(other: CaretWidget) {
    return other.label === this.label && other.colorClass === this.colorClass;
  }

  toDOM() {
    return caretElement({ label: this.label, colorClass: this.colorClass });
  }
}

// A position from another document, kept inside this one.
const boundedBy = ({
  state,
  position,
}: {
  state: EditorState;
  position: number;
}) => Math.max(0, Math.min(position, state.doc.length));

const decorationsFor = ({
  presence,
  state,
  config,
}: {
  presence: PresenceWithSelection;
  state: EditorState;
  config: PresenceArgs;
}): Range<Decoration>[] => {
  const spec: PresenceDecorationSpec = {
    peerId: presence.peerId,
    selection: presence.selection,
  };
  const anchor = boundedBy({ state, position: presence.selection.anchor });
  const head = boundedBy({ state, position: presence.selection.head });

  // A peer's caret follows their typing, so text inserted at it goes before
  // it.
  const caret = Decoration.widget({
    widget: new CaretWidget(
      presence.participant.name,
      config.colorClassFor(presence.participant)
    ),
    side: 1,
    ...spec,
  }).range(head);

  if (anchor === head) return [caret];

  const selection = Decoration.mark({
    class: config.selectionColorClassFor(presence.participant),
    attributes: { 'data-testid': 'presence-selection' },
    ...spec,
  }).range(Math.min(anchor, head), Math.max(anchor, head));

  return [selection, caret];
};

const notOfPeer =
  (peerId: string) =>
  (_from: number, _to: number, decoration: Decoration): boolean =>
    (decoration.spec as PresenceDecorationSpec).peerId !== peerId;

const presencePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;
    // Where each peer last said they are.
    presenceByPeer: ReadonlyMap<string, PresenceWithSelection> = new Map();
    // What was last published, so the same selection is not sent again.
    published: ParticipantSelection | null = null;
    unsubscribe: () => void;
    destroyed = false;

    constructor(readonly view: EditorView) {
      const config = view.state.facet(presenceConfig);

      this.unsubscribe = subscribeToRef(config.peers, (current) => {
        // The first delivery comes while the view is still being built, when
        // dispatching is not safe.
        queueMicrotask(() => {
          if (this.destroyed) return;
          view.dispatch({ effects: setPeers.of(current) });
        });
      });

      this.publishSelection(view.state);
    }

    update(update: ViewUpdate) {
      const config = update.state.facet(presenceConfig);
      const version = config.readSyncState(update.state).baseVersion;
      const versionChanged =
        version !== config.readSyncState(update.startState).baseVersion;
      // The latest peer list this update brings, if any.
      const incoming = update.transactions
        .flatMap((tr) => tr.effects)
        .reduce<ReadonlyArray<RemotePresence<ParticipantSelection>> | null>(
          (latest, effect) => (effect.is(setPeers) ? effect.value : latest),
          null
        );

      // Drawn carets and selections keep their place in the text.
      this.decorations = this.decorations.map(update.changes);

      if (incoming) this.reconcile(incoming);
      if (incoming || versionChanged) {
        this.drawDue({ state: update.state, config, version });
      }

      this.publishSelection(update.state);
      placeLabels(update.view);
    }

    // Records where peers are and removes the decorations of those gone.
    reconcile(incoming: ReadonlyArray<RemotePresence<ParticipantSelection>>) {
      const presenceByPeer = new Map(
        incoming.flatMap(({ selection, ...peer }) =>
          selection === null
            ? []
            : [[peer.peerId, { ...peer, selection }] as const]
        )
      );

      this.decorations = [...this.presenceByPeer.keys()]
        .filter((peerId) => !presenceByPeer.has(peerId))
        .reduce(
          (decorations, peerId) =>
            decorations.update({ filter: notOfPeer(peerId) }),
          this.decorations
        );
      this.presenceByPeer = presenceByPeer;
    }

    // Draws the selections made in the version the editor shows that are
    // not drawn yet; the others keep what is drawn until theirs is shown.
    drawDue({
      state,
      config,
      version,
    }: {
      state: EditorState;
      config: PresenceArgs;
      version: ConvergentDocumentVersion;
    }) {
      const isDrawn = (presence: PresenceWithSelection) => {
        let drawn = false;
        this.decorations.between(0, state.doc.length, (_from, _to, value) => {
          const spec = value.spec as PresenceDecorationSpec;
          if (
            spec.peerId === presence.peerId &&
            selectionsAreSame(spec.selection, presence.selection)
          ) {
            drawn = true;
          }
        });
        return drawn;
      };

      this.decorations = [...this.presenceByPeer.values()]
        .filter(
          (presence) =>
            presence.selection.version === version && !isDrawn(presence)
        )
        .reduce(
          (decorations, presence) =>
            decorations.update({
              filter: notOfPeer(presence.peerId),
              add: decorationsFor({ presence, state, config }),
              sort: true,
            }),
          this.decorations
        );
    }

    // Where we are, for peers.
    publishSelection(state: EditorState) {
      const config = state.facet(presenceConfig);

      // Unfocused: nothing to show, whatever is in flight.
      if (!this.view.hasFocus) return this.publishIfChanged(null);

      const { baseVersion, hasPendingLocalEdits } = config.readSyncState(state);
      // Local edits pending: the version to stamp is not known yet. The
      // transaction that brings their version brings us back here.
      if (hasPendingLocalEdits) return;

      const { anchor, head } = state.selection.main;
      this.publishIfChanged({ anchor, head, version: baseVersion });
    }

    publishIfChanged(selection: ParticipantSelection | null) {
      if (selectionsAreSame(this.published, selection)) return;

      this.published = selection;
      this.view.state.facet(presenceConfig).publish(selection);
    }

    destroy() {
      this.destroyed = true;
      this.unsubscribe();
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

export const getPresenceDecorations = (view: EditorView): DecorationSet =>
  view.plugin(presencePlugin)?.decorations ?? Decoration.none;

// Shows where the others are in the document, and tells them where we are.
// A selection is a pair of offsets valid in the version it names, so it is
// drawn once the editor shows that version, then follows the edits after it.
export const presence = (args: PresenceArgs): Extension => [
  presenceConfig.of(args),
  presencePlugin,
];
