import { Fragment, type Node, NodeType, Schema } from 'prosemirror-model';
import { Plugin, type Transaction } from 'prosemirror-state';

// When any of these blocks is the last block in the document, we add an extra paragraph to
// make it easier for users to exit the block and continue typing.
const blocksThatNeedTrailingParagraph: (schema: Schema) => Array<NodeType> = (
  schema
) => [
  schema.nodes.code_block,
  schema.nodes.blockquote,
  schema.nodes.horizontal_rule,
  schema.nodes.figure,
];

const docNeedsTrailingParagraph = ({
  doc,
  schema,
}: {
  doc: Node;
  schema: Schema;
}): boolean => {
  const lastChild = doc.lastChild;
  return (
    !!lastChild &&
    blocksThatNeedTrailingParagraph(schema).includes(lastChild.type)
  );
};

const isEmptyParagraph = ({
  node,
  schema,
}: {
  node: Node;
  schema: Schema;
}): boolean => node.type === schema.nodes.paragraph && node.childCount === 0;

const withoutLastChild = (doc: Node): Node =>
  doc.copy(
    doc.content.cut(0, doc.content.size - (doc.lastChild?.nodeSize ?? 0))
  );

// Equivalent of `ensureTrailingParagraphPlugin` for first-load docs. The
// plugin only fires on `docChanged` transactions, so it never runs when an
// EditorState is created directly from a doc (initial load). Use this to
// pre-process the doc before constructing the state.
export const ensureTrailingParagraphInDoc = ({
  doc,
  schema,
}: {
  doc: Node;
  schema: Schema;
}): Node => {
  // A doc without blocks cannot be edited either.
  if (doc.childCount === 0 || docNeedsTrailingParagraph({ doc, schema })) {
    return doc.copy(
      doc.content.append(Fragment.from(schema.nodes.paragraph.create()))
    );
  }
  return doc;
};

// The exact inverse of `ensureTrailingParagraphInDoc`: only the paragraph
// that function would add comes off; any other last paragraph is content.
export const stripTrailingParagraphFromDoc = ({
  doc,
  schema,
}: {
  doc: Node;
  schema: Schema;
}): Node => {
  const lastChild = doc.lastChild;
  if (!lastChild || !isEmptyParagraph({ node: lastChild, schema })) return doc;

  const stripped = withoutLastChild(doc);
  return docNeedsTrailingParagraph({ doc: stripped, schema }) ? stripped : doc;
};

const endsWithEmptyParagraph = ({
  doc,
  schema,
}: {
  doc: Node;
  schema: Schema;
}): boolean =>
  !!doc.lastChild && isEmptyParagraph({ node: doc.lastChild, schema });

// Steps computed for a doc without the trailing paragraph leave the
// transaction's end to be lined up with the target's.
export const matchTrailingParagraph = ({
  tr,
  target,
  schema,
}: {
  tr: Transaction;
  target: Node;
  schema: Schema;
}): Transaction => {
  const trDoc = tr.doc;
  const trDocHasTrailingParagraph = endsWithEmptyParagraph({
    doc: trDoc,
    schema,
  });
  const targetDocHasTrailingParagraph = endsWithEmptyParagraph({
    doc: target,
    schema,
  });

  if (targetDocHasTrailingParagraph && !trDocHasTrailingParagraph) {
    return tr.insert(trDoc.content.size, schema.nodes.paragraph.create());
  }

  // A doc cannot be left without blocks.
  if (
    trDocHasTrailingParagraph &&
    !targetDocHasTrailingParagraph &&
    trDoc.lastChild &&
    trDoc.childCount > 1
  ) {
    return tr.delete(
      trDoc.content.size - trDoc.lastChild.nodeSize,
      trDoc.content.size
    );
  }

  return tr;
};

export const ensureTrailingParagraphPlugin = (schema: Schema) => {
  return new Plugin({
    appendTransaction(transactions, _, newState) {
      // Check if any transactions modified the document
      if (!transactions.some((tr) => tr.docChanged)) {
        return null;
      }

      const { doc } = newState;
      if (!docNeedsTrailingParagraph({ doc, schema })) return null;

      // Append a paragraph to the end of the document
      const { tr } = newState;
      tr.insert(doc.content.size, schema.nodes.paragraph.create());
      return tr;
    },
  });
};
