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

export {
  wrapInList,
  splitListItem,
  liftListItem,
  sinkListItem,
} from 'prosemirror-schema-list';
