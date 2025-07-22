import { Node } from 'prosemirror-model';

export const getNoteRefs = (doc: Node) => {
  const refs: Array<{ node: Node; pos: number }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'note_ref') {
      refs.push({ node, pos });
    }
  });
  return refs;
};

export const getNoteContentBlocks = (doc: Node) => {
  const contentBlocks: Array<{ node: Node; pos: number }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'note_content') {
      contentBlocks.push({ node, pos });
    }
  });
  return contentBlocks;
};
