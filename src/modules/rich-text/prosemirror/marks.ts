import type { MarkType, Node } from 'prosemirror-model';

type SearchDirection = 'BACKWARD' | 'FORWARD';

// Finds the mark boundary given a search direction (backward/forward)
const findMarkBoundary =
  (markType: MarkType) =>
  ({
    pos,
    doc,
    direction,
  }: {
    pos: number;
    doc: Node;
    direction: SearchDirection;
  }): number => {
    if (pos < 0 || pos >= doc.content.size) {
      // Base case: Out of bounds
      return pos;
    }

    const currentPos = doc.resolve(pos);
    if (!markType.isInSet(currentPos.marks())) {
      // Base case: Mark no longer present
      return pos;
    }

    // Recursive step: Move in the specified direction
    return findMarkBoundary(markType)({
      pos: direction === 'BACKWARD' ? pos - 1 : pos + 1,
      doc,
      direction,
    });
  };

export const findMarkBoundaries =
  (markType: MarkType) =>
  ({ pos, doc }: { pos: number; doc: Node }): [number, number] => {
    const start = findMarkBoundary(markType)({
      pos,
      doc,
      direction: 'BACKWARD',
    });
    const end = findMarkBoundary(markType)({
      pos,
      doc,
      direction: 'FORWARD',
    });

    return [start, end];
  };
