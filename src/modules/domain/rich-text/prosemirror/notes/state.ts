import { Node } from 'prosemirror-model';

export const getNotes = (
  doc: Node
): {
  refs: Array<{ node: Node; pos: number }>;
  contentBlocks: Array<{ node: Node; pos: number }>;
} => {
  const notes = {
    refs: [] as Array<{ node: Node; pos: number }>,
    contentBlocks: [] as Array<{ node: Node; pos: number }>,
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
