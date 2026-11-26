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
import {
  applyMetadataEdit,
  mergeFrontMatter,
  type MetadataEdit,
} from '../../models';
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
  type FrontMatterEdit,
  type FrontMatterEditFailure,
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
      currentFrontMatter: string | null
    ) => Either.Either<string, InvalidMetadataError | InvalidMetadataKeyError>;
    toMeta: (change: FrontMatterChange) => MetadataEditingMeta;
  }): Effect.Effect<void, CommitError> =>
    Effect.suspend(() => {
      const { view, normalizeFrontMatter } = deps;
      const currentFrontMatter = getDocFrontMatter(view.state.doc);

      return pipe(
        apply(currentFrontMatter),
        Effect.flatMap(normalizeFrontMatter),
        Effect.flatMap((normalized) => {
          if (view.isDestroyed) {
            return Effect.void;
          }

          // Another change reached the front matter meanwhile.
          if (getDocFrontMatter(view.state.doc) !== currentFrontMatter) {
            return commitChange(deps)({ apply, toMeta });
          }

          const meta = toMeta({
            before: currentFrontMatter,
            after: normalized,
          });

          return Effect.sync(() =>
            setFrontMatter(normalized)(view.state, (tr) =>
              view.dispatch(tr.setMeta(pluginKey, meta))
            )
          );
        })
      );
    });

const commitMetadataEdit =
  (deps: CommitDeps) =>
  (edit: MetadataEdit): Effect.Effect<void, CommitError> =>
    commitChange(deps)({
      apply: (frontMatter) => applyMetadataEdit({ frontMatter, edit }),
      toMeta: (change) => ({ type: 'metadataEdited', key: edit.key, change }),
    });

const commitFrontMatterEdit =
  (deps: CommitDeps) =>
  (edit: FrontMatterEdit): Effect.Effect<void, CommitError> =>
    commitChange(deps)({
      apply: (currentFrontMatter) =>
        mergeFrontMatter({
          base: edit.base,
          yours: edit.frontMatter,
          theirs: currentFrontMatter,
        }),
      toMeta: (change) => ({ type: 'frontMatterEdited', change }),
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

const dispatchMeta =
  ({ view }: { view: EditorView }) =>
  (meta: MetadataEditingMeta): Effect.Effect<void> =>
    Effect.sync(() => {
      if (!view.isDestroyed) {
        view.dispatch(view.state.tr.setMeta(pluginKey, meta));
      }
    });

const storeMetadataEditFailure =
  (deps: { view: EditorView }) =>
  (failure: MetadataEditFailure): Effect.Effect<void> =>
    dispatchMeta(deps)({ type: 'metadataEditFailed', failure });

const storeFrontMatterEditFailure =
  (deps: { view: EditorView }) =>
  (failure: FrontMatterEditFailure): Effect.Effect<void> =>
    dispatchMeta(deps)({ type: 'frontMatterEditFailed', failure });

const dropNextChange =
  (deps: { view: EditorView }) =>
  (operation: MetadataEditHistoryOperation): Effect.Effect<void> =>
    dispatchMeta(deps)({ type: 'reversalFailed', operation });

const processCommit =
  (deps: ProcessCommitDeps) =>
  (commit: MetadataEditCommit): Effect.Effect<void> => {
    const report = (cause: Cause.Cause<unknown>): Effect.Effect<void> =>
      Effect.sync(() => deps.onError(Cause.squash(cause)));

    switch (commit.type) {
      case 'metadataEdit': {
        const { edit } = commit;
        const storedFailure = (error: MetadataEditFailure['error']) =>
          storeMetadataEditFailure(deps)({ edit, error });

        return pipe(
          commitMetadataEdit(deps)(edit),
          Effect.catchTags({
            InvalidMetadataError: storedFailure,
            InvalidMetadataKeyError: storedFailure,
            UnrepresentableContentError: storedFailure,
          }),
          Effect.catchAllCause(report)
        );
      }
      case 'frontMatterEdit': {
        const { edit } = commit;
        const storedFailure = (error: FrontMatterEditFailure['error']) =>
          storeFrontMatterEditFailure(deps)({ edit, error });

        return pipe(
          commitFrontMatterEdit(deps)(edit),
          Effect.catchTags({
            InvalidMetadataError: storedFailure,
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
    case 'metadataEditFailed':
      return {
        ...state,
        metadataEditFailures: new Map([
          ...state.metadataEditFailures,
          [meta.failure.edit.key, meta.failure],
        ]),
      };
    case 'metadataEditFailureCleared':
      return {
        ...state,
        metadataEditFailures: withoutFailure({
          failures: state.metadataEditFailures,
          key: meta.key,
        }),
      };
    case 'metadataEdited':
      return {
        ...state,
        metadataEditFailures: withoutFailure({
          failures: state.metadataEditFailures,
          key: meta.key,
        }),
        history: withCommit({ history: state.history, change: meta.change }),
      };
    case 'frontMatterEditFailed':
      return { ...state, frontMatterEditFailure: meta.failure };
    case 'frontMatterEditFailureCleared':
      return { ...state, frontMatterEditFailure: null };
    case 'frontMatterEdited':
      return {
        ...state,
        frontMatterEditFailure: null,
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
      init: () => ({
        metadataEditFailures: new Map(),
        frontMatterEditFailure: null,
        history: emptyHistory,
      }),
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
