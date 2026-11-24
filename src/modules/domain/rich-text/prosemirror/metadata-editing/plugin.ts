import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import { pipe } from 'effect/Function';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import { Plugin } from 'prosemirror-state';
import { type EditorView } from 'prosemirror-view';

import {
  type InvalidMetadataError,
  type RepresentationTransformError,
  type UnrepresentableContentError,
} from '../../errors';
import { applyMetadataEdit, type MetadataEdit } from '../../models';
import { type RepresentationTransform } from '../../ports/representation-transform';
import { getDocFrontMatter } from '../front-matter';
import { setFrontMatter } from './commands';
import {
  type MetadataEditFailure,
  type MetadataEditFailures,
  type MetadataEditingMeta,
  pluginKey,
} from './state';

// An edit the front matter can't take, or a failed normalization.
type CommitError =
  | InvalidMetadataError
  | UnrepresentableContentError
  | RepresentationTransformError;

export type MetadataEditingPluginArgs = {
  normalizeFrontMatter: RepresentationTransform['normalizeFrontMatter'];
  onError: (error: unknown) => void;
};

// Applies the edit to the current front matter and normalizes it, then sets it
// on the document if the front matter is still the one the edit was applied to.
const commitEdit =
  ({
    normalizeFrontMatter,
  }: Pick<MetadataEditingPluginArgs, 'normalizeFrontMatter'>) =>
  ({
    view,
    edit,
  }: {
    view: EditorView;
    edit: MetadataEdit;
  }): Effect.Effect<void, CommitError> =>
    Effect.suspend(() => {
      const frontMatter = getDocFrontMatter(view.state.doc);

      return pipe(
        applyMetadataEdit({ frontMatter, edit }),
        Effect.flatMap(normalizeFrontMatter),
        Effect.flatMap((normalized) => {
          if (view.isDestroyed) {
            return Effect.void;
          }

          // Another change reached the front matter meanwhile.
          if (getDocFrontMatter(view.state.doc) !== frontMatter) {
            return commitEdit({ normalizeFrontMatter })({ view, edit });
          }

          // The property's earlier failure no longer stands.
          const meta: MetadataEditingMeta = {
            type: 'failureCleared',
            key: edit.key,
          };

          return Effect.sync(() =>
            setFrontMatter(normalized)(view.state, (tr) =>
              view.dispatch(tr.setMeta(pluginKey, meta))
            )
          );
        })
      );
    });

// Keeps the edit's failure in the plugin's state, for its property.
const keepFailure =
  ({ view, edit }: { view: EditorView; edit: MetadataEdit }) =>
  (error: MetadataEditFailure['error']): Effect.Effect<void> =>
    Effect.sync(() => {
      if (view.isDestroyed) {
        return;
      }

      const meta: MetadataEditingMeta = {
        type: 'failed',
        failure: { edit, error },
      };
      view.dispatch(view.state.tr.setMeta(pluginKey, meta));
    });

const applyMeta = ({
  failures,
  meta,
}: {
  failures: MetadataEditFailures;
  meta: MetadataEditingMeta;
}): MetadataEditFailures => {
  switch (meta.type) {
    case 'failed':
      return new Map([...failures, [meta.failure.edit.key, meta.failure]]);
    case 'failureCleared':
      return failures.has(meta.key)
        ? new Map([...failures].filter(([key]) => key !== meta.key))
        : failures;
  }
};

export const metadataEditingPlugin = ({
  normalizeFrontMatter,
  onError,
}: MetadataEditingPluginArgs) => {
  const edits = Effect.runSync(Queue.unbounded<MetadataEdit>());
  const commit = commitEdit({ normalizeFrontMatter });

  return new Plugin<MetadataEditFailures>({
    key: pluginKey,
    edits,
    state: {
      init: () => new Map(),
      apply: (tr, failures) => {
        const meta: MetadataEditingMeta | undefined = tr.getMeta(pluginKey);

        return meta ? applyMeta({ failures, meta }) : failures;
      },
    },
    view: (view) => {
      // Commits the edits one at a time, in the order they were made, until
      // the plugin's view goes away. A failure of the edit itself is kept for
      // its property; any other is reported.
      const committer = Effect.runFork(
        pipe(
          Stream.fromQueue(edits),
          Stream.runForEach((edit) =>
            pipe(
              commit({ view, edit }),
              Effect.catchTags({
                InvalidMetadataError: keepFailure({ view, edit }),
                UnrepresentableContentError: keepFailure({ view, edit }),
              }),
              Effect.catchAllCause((cause) =>
                Effect.sync(() => onError(Cause.squash(cause)))
              )
            )
          )
        )
      );

      return {
        destroy: () => {
          Effect.runFork(Fiber.interrupt(committer));
        },
      };
    },
  });
};
