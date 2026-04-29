import { type Fragment, NodeType, Schema } from 'prosemirror-model';
import {
  NodeSelection,
  Plugin,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';
import { ReplaceAroundStep, ReplaceStep } from 'prosemirror-transform';

// When any of these blocks is the last block in the document, we add an extra paragraph to
// make it easier for users to exit the block and continue typing.
const blocksThatNeedTrailingParagraph: (schema: Schema) => Array<NodeType> = (
  schema
) => [
  schema.nodes.code_block,
  schema.nodes.blockquote,
  schema.nodes.horizontal_rule,
];

export const ensureTrailingParagraphPlugin = (schema: Schema) => {
  return new Plugin({
    appendTransaction(transactions, _, newState) {
      // Check if any transactions modified the document
      if (!transactions.some((tr) => tr.docChanged)) {
        return null;
      }

      const { doc } = newState;
      const lastNode = doc.lastChild;

      // Ensure that the last node needs a trailing paragraph to facilitate editing.
      if (
        lastNode &&
        blocksThatNeedTrailingParagraph(schema).includes(lastNode.type)
      ) {
        const { tr } = newState;

        // Append a paragraph to the end of the document
        tr.insert(doc.content.size, schema.nodes.paragraph.create());
        return tr;
      }

      return null;
    },
  });
};

// After one of these block types is inserted (via command, input rule, paste, etc),
// the cursor moves out of it and into the following block.
const blocksForWhichCursorMovesToNextBlockOnInsertion: (
  schema: Schema
) => Array<NodeType> = (schema) => [schema.nodes.horizontal_rule];

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

const transactionsInsertedNodeOfType = ({
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

export const moveCursorToNextBlockOnInsertionPlugin = (schema: Schema) =>
  new Plugin({
    appendTransaction(transactions, _, newState) {
      const { selection } = newState;
      if (!(selection instanceof NodeSelection)) return null;

      const targetTypes =
        blocksForWhichCursorMovesToNextBlockOnInsertion(schema);
      if (!targetTypes.includes(selection.node.type)) return null;

      // Distinguish a freshly-inserted node from one that just became selected
      // (e.g. Backspace at the start of the paragraph after an HR). The latter
      // doesn't replace anything with new content, so we leave the selection
      // alone and let the user delete the node with a second keypress.
      if (
        !transactionsInsertedNodeOfType({ transactions, types: targetTypes })
      ) {
        return null;
      }

      const $afterNode = newState.doc.resolve(
        selection.from + selection.node.nodeSize
      );
      const next = TextSelection.findFrom($afterNode, 1);
      if (!next) return null;

      return newState.tr.setSelection(next);
    },
  });

/**
 * Ensures that if a paragraph ends with an inline atom (e.g., note_ref),
 * a non-breaking space is always appended after it.
 */
export const ensureTrailingSpaceAfterAtomPlugin = () =>
  new Plugin({
    appendTransaction(_, __, newState) {
      const { doc } = newState;
      const tr = newState.tr;

      doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph' && node.childCount > 0) {
          const lastChild = node.lastChild;
          // Only insert a non-breaking space if the last child is an atom and not a text node
          if (
            lastChild &&
            lastChild.isAtom &&
            lastChild.isInline &&
            lastChild.type.name !== 'text'
          ) {
            // Insert the space immediately after the last atom
            const lastChildPos =
              pos + node.content.size - lastChild.nodeSize + 1;
            const insertPos = lastChildPos + lastChild.nodeSize;
            tr.insertText('\u00A0', insertPos);
          }
        }
        return true;
      });

      return tr.steps.length ? tr : null;
    },
  });

export {
  wrapInList,
  splitListItem,
  liftListItem,
  sinkListItem,
} from 'prosemirror-schema-list';
