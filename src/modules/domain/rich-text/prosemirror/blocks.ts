import { NodeType, Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';

// When any of these blocks is the last block in the document, we add an extra paragraph to
// make it easier for users to exit the block and continue typing.
const blocksThatNeedTrailingParagraph: (schema: Schema) => Array<NodeType> = (
  schema
) => [schema.nodes.code_block, schema.nodes.blockquote];

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
