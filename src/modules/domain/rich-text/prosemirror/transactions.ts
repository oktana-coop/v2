import { type Fragment, type NodeType } from 'prosemirror-model';
import { type Transaction } from 'prosemirror-state';
import { ReplaceAroundStep, ReplaceStep } from 'prosemirror-transform';

const fragmentContainsNodeOfType = ({
  fragment,
  types,
}: {
  fragment: Fragment;
  types: Array<NodeType>;
}): boolean =>
  fragment.content.some(
    (node) =>
      types.includes(node.type) ||
      fragmentContainsNodeOfType({ fragment: node.content, types })
  );

export const transactionsInsertedNodeOfType = ({
  transactions,
  types,
}: {
  transactions: readonly Transaction[];
  types: Array<NodeType>;
}): boolean =>
  transactions.some((tr) =>
    tr.steps.some(
      (step) =>
        (step instanceof ReplaceStep || step instanceof ReplaceAroundStep) &&
        fragmentContainsNodeOfType({ fragment: step.slice.content, types })
    )
  );

export const transactionsMayHaveRemovedContent = ({
  transactions,
}: {
  transactions: readonly Transaction[];
}): boolean =>
  transactions.some((tr) =>
    tr.steps.some(
      (step) =>
        (step instanceof ReplaceStep || step instanceof ReplaceAroundStep) &&
        step.slice.size < step.to - step.from
    )
  );
