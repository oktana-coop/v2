import { render, screen } from '@testing-library/react';
import { type NodeApi, type NodeRendererProps } from 'react-arborist';
import { describe, expect, it } from 'vitest';

import { filesystemItemTypes } from '../../../../../../../modules/infrastructure/filesystem';
import { type ExplorerTreeNode } from '../../../../../hooks';
import { TreeNode } from './TreeNode';

// Minimal NodeApi stub: TreeNode only reads these fields at render time (the
// click/toggle callbacks are exercised on interaction, not while rendering).
const makeFileNode = (name: string): NodeApi<ExplorerTreeNode> =>
  ({
    id: name,
    level: 0,
    isSelected: false,
    isOpen: false,
    data: { id: name, name, type: filesystemItemTypes.FILE },
    handleClick: () => {},
    toggle: () => {},
  }) as unknown as NodeApi<ExplorerTreeNode>;

const renderFileNode = (name: string) => {
  const props = {
    node: makeFileNode(name),
    style: {},
  } as unknown as NodeRendererProps<ExplorerTreeNode>;

  return render(<TreeNode {...props} />);
};

describe('TreeNode file dimming', () => {
  it('dims files the editor cannot open', () => {
    renderFileNode('image.png');

    const row = screen.getByText('image.png').closest('div');
    expect(row).toHaveClass('opacity-50');
    expect(row).toHaveAttribute('title', "image.png can't be opened");
  });

  it('does not dim openable documents', () => {
    renderFileNode('notes.md');

    const row = screen.getByText('notes.md').closest('div');
    expect(row).not.toHaveClass('opacity-50');
    expect(row).not.toHaveAttribute('title');
  });
});
