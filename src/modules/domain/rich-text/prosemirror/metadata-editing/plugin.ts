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
import { pluginKey } from './state';

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

          return Effect.sync(() =>
            setFrontMatter(normalized)(view.state, view.dispatch)
          );
        })
      );
    });

export const metadataEditingPlugin = ({
  normalizeFrontMatter,
  onError,
}: MetadataEditingPluginArgs) => {
  const edits = Effect.runSync(Queue.unbounded<MetadataEdit>());
  const commit = commitEdit({ normalizeFrontMatter });

  return new Plugin({
    key: pluginKey,
    edits,
    view: (view) => {
      // Commits the edits one at a time, in the order they were made, until
      // the plugin's view goes away.
      const committer = Effect.runFork(
        pipe(
          Stream.fromQueue(edits),
          Stream.runForEach((edit) =>
            pipe(
              commit({ view, edit }),
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
