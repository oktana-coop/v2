import { type NodeRendererProps } from 'react-arborist';

import { GUEST_SHARE } from '../../../../modules/infrastructure/cross-platform';
import { FileDocumentIcon } from '../../components/icons';
import {
  treeEditingRowClasses,
  treeRowClasses,
  TreeRowInput,
} from '../../components/tree';
import { formatCommitDate } from '../project/shared/historical-view/commit-info';

export type GuestShareNodeData = {
  id: string;
  name: string;
  lastOpenedAt: number;
};

const ROW_PADDING_LEFT = 40;

const EditingGuestShareNode = ({
  style,
  node,
}: NodeRendererProps<GuestShareNodeData>) => (
  <div
    className={treeEditingRowClasses}
    style={{ ...style, paddingLeft: ROW_PADDING_LEFT }}
  >
    <FileDocumentIcon
      className="mr-2 shrink-0 text-zinc-700 dark:text-zinc-300"
      size={20}
    />
    <TreeRowInput
      className="flex-1"
      defaultValue={node.data.name}
      label="Shared document name"
      onSubmit={(value) => node.submit(value)}
      onCancel={() => node.reset()}
    />
  </div>
);

export const GuestShareNode = (
  props: NodeRendererProps<GuestShareNodeData>
) => {
  const { node, style } = props;

  if (node.isEditing) return <EditingGuestShareNode {...props} />;

  const handleContextMenu = (ev: React.MouseEvent) => {
    ev.preventDefault();
    window.electronAPI.showContextMenu({
      context: GUEST_SHARE,
      shareId: node.id,
    });
  };

  return (
    <div
      onClick={(ev) => node.handleClick(ev)}
      onContextMenu={handleContextMenu}
      className={treeRowClasses(node.isSelected)}
      style={{ ...style, paddingLeft: ROW_PADDING_LEFT }}
      title={`Last opened ${formatCommitDate(new Date(node.data.lastOpenedAt))}`}
      data-testid="guest-share"
    >
      <FileDocumentIcon
        className="mr-2 shrink-0 text-zinc-700 dark:text-zinc-300"
        size={20}
      />
      {node.data.name}
    </div>
  );
};
