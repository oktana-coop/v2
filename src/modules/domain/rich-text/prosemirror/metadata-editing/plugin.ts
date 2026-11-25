import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import type * as Either from 'effect/Either';
import * as Fiber from 'effect/Fiber';
import { pipe } from 'effect/Function';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import { Plugin } from 'prosemirror-state';
import { type EditorView } from 'prosemirror-view';

import {
  type InvalidMetadataError,
  type InvalidMetadataKeyError,
  type RepresentationTransformError,
  type UnrepresentableContentError,
} from '../../errors';
import { applyMetadataEdit, type MetadataEdit } from '../../models';
import { type RepresentationTransform } from '../../ports/representation-transform';
import { getDocFrontMatter } from '../front-matter';
import { setFrontMatter } from './commands';
import {
  emptyHistory,
  type FrontMatterChange,
  type MetadataEditHistoryOperation,
  nextChange,
  reverseChange,
  withCommit,
  withoutNextChange,
  withReversal,
} from './history';
import {
  getMetadataHistory,
  type MetadataEditCommit,
  type MetadataEditFailure,
  type MetadataEditFailures,
  type MetadataEditingMeta,
  type MetadataEditingState,
  pluginKey,
} from './state';

// Front matter that can't be changed that way, or a failed normalization.
type CommitError =
  | InvalidMetadataError
  | InvalidMetadataKeyError
  | UnrepresentableContentError
  | RepresentationTransformError;

export type MetadataEditingPluginArgs = {
  normalizeFrontMatter: RepresentationTransform['normalizeFrontMatter'];
  onError: (error: unknown) => void;
};

type CommitDeps = {
  view: EditorView;
  normalizeFrontMatter: MetadataEditingPluginArgs['normalizeFrontMatter'];
};

type ProcessCommitDeps = CommitDeps &
  Pick<MetadataEditingPluginArgs, 'onError'>;

// Applies the change to the current front matter and normalizes it, then sets
// it on the document, with the meta for the change, if the front matter is
// still the one it was applied to.
const commitChange =
  (deps: CommitDeps) =>
  ({
    apply,
    toMeta,
  }: {
    apply: (
      frontMatter: string | null
    ) => Either.Either<string, InvalidMetadataError | InvalidMetadataKeyError>;
    toMeta: (change: FrontMatterChange) => MetadataEditingMeta;
  }): Effect.Effect<void, CommitError> =>
    Effect.suspend(() => {
      const { view, normalizeFrontMatter } = deps;
      const frontMatter = getDocFrontMatter(view.state.doc);

      return pipe(
        apply(frontMatter),
        Effect.flatMap(normalizeFrontMatter),
        Effect.flatMap((normalized) => {
          if (view.isDestroyed) {
            return Effect.void;
          }

          // Another change reached the front matter meanwhile.
          if (getDocFrontMatter(view.state.doc) !== frontMatter) {
            return commitChange(deps)({ apply, toMeta });
          }

          const meta = toMeta({ before: frontMatter, after: normalized });

          return Effect.sync(() =>
            setFrontMatter(normalized)(view.state, (tr) =>
              view.dispatch(tr.setMeta(pluginKey, meta))
            )
          );
        })
      );
    });

const commitEdit =
  (deps: CommitDeps) =>
  (edit: MetadataEdit): Effect.Effect<void, CommitError> =>
    commitChange(deps)({
      apply: (frontMatter) => applyMetadataEdit({ frontMatter, edit }),
      toMeta: (change) => ({ type: 'committed', key: edit.key, change }),
    });

const commitReversal =
  (deps: CommitDeps) =>
  (operation: MetadataEditHistoryOperation): Effect.Effect<void, CommitError> =>
    Effect.suspend(() => {
      const change = nextChange({
        history: getMetadataHistory(deps.view.state),
        operation,
      });

      if (change === undefined) {
        return Effect.void;
      }

      return commitChange(deps)({
        apply: (frontMatter) => reverseChange({ change, frontMatter }),
        toMeta: (madeChange) => ({
          type: 'reversed',
          operation,
          change: madeChange,
        }),
      });
    });

const storeFailure =
  ({ view }: { view: EditorView }) =>
  (failure: MetadataEditFailure): Effect.Effect<void> =>
    Effect.sync(() => {
      if (view.isDestroyed) {
        return;
      }

      const meta: MetadataEditingMeta = { type: 'failed', failure };
      view.dispatch(view.state.tr.setMeta(pluginKey, meta));
    });

const dropNextChange =
  ({ view }: { view: EditorView }) =>
  (operation: MetadataEditHistoryOperation): Effect.Effect<void> =>
    Effect.sync(() => {
      if (view.isDestroyed) {
        return;
      }

      const meta: MetadataEditingMeta = { type: 'reversalFailed', operation };
      view.dispatch(view.state.tr.setMeta(pluginKey, meta));
    });

const processCommit =
  (deps: ProcessCommitDeps) =>
  (commit: MetadataEditCommit): Effect.Effect<void> => {
    const report = (cause: Cause.Cause<unknown>): Effect.Effect<void> =>
      Effect.sync(() => deps.onError(Cause.squash(cause)));

    switch (commit.type) {
      case 'edit': {
        const { edit } = commit;
        const storedFailure = (error: MetadataEditFailure['error']) =>
          storeFailure(deps)({ edit, error });

        return pipe(
          commitEdit(deps)(edit),
          Effect.catchTags({
            InvalidMetadataError: storedFailure,
            InvalidMetadataKeyError: storedFailure,
            UnrepresentableContentError: storedFailure,
          }),
          Effect.catchAllCause(report)
        );
      }
      case 'undo':
      case 'redo': {
        const operation = commit.type;

        return pipe(
          commitReversal(deps)(operation),
          Effect.tapErrorCause(() => dropNextChange(deps)(operation)),
          Effect.catchAllCause(report)
        );
      }
    }
  };

const withoutFailure = ({
  failures,
  key,
}: {
  failures: MetadataEditFailures;
  key: string;
}): MetadataEditFailures =>
  failures.has(key)
    ? new Map([...failures].filter(([failedKey]) => failedKey !== key))
    : failures;

const applyMeta = ({
  state,
  meta,
}: {
  state: MetadataEditingState;
  meta: MetadataEditingMeta;
}): MetadataEditingState => {
  switch (meta.type) {
    case 'failed':
      return {
        ...state,
        failures: new Map([
          ...state.failures,
          [meta.failure.edit.key, meta.failure],
        ]),
      };
    case 'failureCleared':
      return {
        ...state,
        failures: withoutFailure({ failures: state.failures, key: meta.key }),
      };
    case 'committed':
      return {
        failures: withoutFailure({ failures: state.failures, key: meta.key }),
        history: withCommit({ history: state.history, change: meta.change }),
      };
    case 'reversed':
      return {
        ...state,
        history: withReversal({
          history: state.history,
          operation: meta.operation,
          change: meta.change,
        }),
      };
    case 'reversalFailed':
      return {
        ...state,
        history: withoutNextChange({
          history: state.history,
          operation: meta.operation,
        }),
      };
  }
};

export const metadataEditingPlugin = ({
  normalizeFrontMatter,
  onError,
}: MetadataEditingPluginArgs) => {
  const commits = Effect.runSync(Queue.unbounded<MetadataEditCommit>());

  return new Plugin<MetadataEditingState>({
    key: pluginKey,
    commits,
    state: {
      init: () => ({ failures: new Map(), history: emptyHistory }),
      apply: (tr, state) => {
        const meta: MetadataEditingMeta | undefined = tr.getMeta(pluginKey);

        return meta ? applyMeta({ state, meta }) : state;
      },
    },
    view: (view) => {
      // Runs the commits one at a time, in the order they were made, until the
      // plugin's view goes away.
      const commitProcessing = Effect.runFork(
        pipe(
          Stream.fromQueue(commits),
          Stream.runForEach(
            processCommit({ view, normalizeFrontMatter, onError })
          )
        )
      );

      return {
        destroy: () => {
          Effect.runFork(Fiber.interrupt(commitProcessing));
        },
      };
    },
  });
};
