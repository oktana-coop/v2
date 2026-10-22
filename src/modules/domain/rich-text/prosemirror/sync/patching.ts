import * as Either from 'effect/Either';
import { pipe } from 'effect/Function';
import { type Node } from 'prosemirror-model';
import { type EditorState, type Transaction } from 'prosemirror-state';
import { type Step } from 'prosemirror-transform';

import { PatchError } from '../../errors';
import { matchTrailingParagraph } from '../trailing-paragraph';

const stepError = ({
  stepIndex,
  reason,
}: {
  stepIndex: number;
  reason: unknown;
}) =>
  new PatchError(
    `${reason instanceof Error ? reason.message : String(reason)} (step ${stepIndex})`
  );

// `maybeStep` reports a rejected step; a step at a position outside the doc
// throws instead.
const applyStep = ({
  tr,
  step,
  stepIndex,
}: {
  tr: Transaction;
  step: Step;
  stepIndex: number;
}): Either.Either<Transaction, PatchError> =>
  pipe(
    Either.try({
      try: () => tr.maybeStep(step),
      catch: (reason) => stepError({ stepIndex, reason }),
    }),
    Either.flatMap(({ failed }) =>
      failed === null
        ? Either.right(tr)
        : Either.left(stepError({ stepIndex, reason: failed }))
    )
  );

// The precise update: the steps applied in order, the trailing paragraph
// settled, and the outcome checked against the target.
export const patch = ({
  state,
  steps,
  target,
}: {
  state: EditorState;
  steps: Step[];
  target: Node;
}): Either.Either<Transaction, PatchError> =>
  pipe(
    steps.reduce<Either.Either<Transaction, PatchError>>(
      (applied, step, stepIndex) =>
        Either.flatMap(applied, (tr) => applyStep({ tr, step, stepIndex })),
      Either.right(state.tr)
    ),
    Either.map((tr) =>
      matchTrailingParagraph({ tr, target, schema: state.schema })
    ),
    Either.filterOrLeft(
      (tr) => tr.doc.eq(target),
      () =>
        new PatchError('The applied steps do not produce the incoming document')
    )
  );

// The coarse update: the target's doc attributes, then one replace of the
// region that differs, so a caret outside it keeps its place.
export const coarseDiffReplace = ({
  state,
  target,
}: {
  state: EditorState;
  target: Node;
}): Transaction => {
  const tr = Object.entries(target.attrs).reduce(
    (attrsSet, [attr, value]) => attrsSet.setDocAttribute(attr, value),
    state.tr
  );

  const start = state.doc.content.findDiffStart(target.content);
  const end = state.doc.content.findDiffEnd(target.content);

  if (start === null || end === null) return tr;

  const overlap = Math.max(0, start - Math.min(end.a, end.b));

  return tr.replace(
    start,
    end.a + overlap,
    target.slice(start, end.b + overlap)
  );
};
