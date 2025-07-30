import { Node } from 'prosemirror-model';

export type NodeWithPos = {
  node: Node;
  pos: number;
};

export const getNotes = (
  doc: Node
): {
  refs: Array<NodeWithPos>;
  contentBlocks: Array<NodeWithPos>;
} => {
  const notes = {
    refs: [] as Array<NodeWithPos>,
    contentBlocks: [] as Array<NodeWithPos>,
  };

  doc.descendants((node, pos) => {
    if (node.type.name === 'note_ref') {
      notes.refs.push({ node, pos });
    } else if (node.type.name === 'note_content') {
      notes.contentBlocks.push({ node, pos });
    }

    return true;
  });

  return {
    refs: notes.refs.sort((a, b) => a.pos - b.pos),
    contentBlocks: notes.contentBlocks.sort((a, b) => a.pos - b.pos),
  };
};
