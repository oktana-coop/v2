import type { MarkType, Node } from 'prosemirror-model';

type SearchDirection = 'BACKWARD' | 'FORWARD';

type FindMarkBoundaryProps = {
  currentPos: number;
  doc: Node;
  direction: SearchDirection;
};

// Finds the mark boundary given a search direction (backward/forward)
export const findMarkBoundary =
  (markType: MarkType) =>
  ({ currentPos, doc, direction }: FindMarkBoundaryProps): number => {
    if (currentPos < 0 || currentPos >= doc.content.size) {
      // Base case: Out of bounds
      return currentPos;
    }

    const $current = doc.resolve(currentPos);
    if (!markType.isInSet($current.marks())) {
      // Base case: Mark no longer present
      return currentPos;
    }

    // Recursive step: Move in the specified direction
    return findMarkBoundary(markType)({
      currentPos: direction === 'BACKWARD' ? currentPos - 1 : currentPos + 1,
      doc,
      direction,
    });
  };
