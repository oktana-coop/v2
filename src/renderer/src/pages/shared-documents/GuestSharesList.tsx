import { useCallback, useContext, useRef } from 'react';
import { type NodeApi, type TreeApi } from 'react-arborist';
import { useNavigate } from 'react-router';

import { urlEncodeShareId } from '../../../../modules/domain/project';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import {
  GuestEditingContext,
  GuestShareRegistryContext,
} from '../../app-state';
import { Button } from '../../components/actions/Button';
import { GroupIcon } from '../../components/icons';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import { AutoSizedTree, TREE_ROW_HEIGHT } from '../../components/tree';
import { GuestShareNode, type GuestShareNodeData } from './GuestShareNode';
import { useGuestShareContextMenu } from './use-guest-share-context-menu';

const EmptyView = ({
  onJoinButtonClick,
}: {
  onJoinButtonClick: () => void;
}) => (
  <div className="flex h-full flex-col items-center justify-center gap-4">
    <p>Nothing shared with you yet.</p>
    <Button
      onClick={onJoinButtonClick}
      variant="solid"
      color="purple"
      className="w-64"
    >
      <GroupIcon className="mr-1" />
      Join shared document
    </Button>
  </div>
);

export const GuestSharesList = () => {
  const {
    guestShares,
    registry: { labelShare },
  } = useContext(GuestShareRegistryContext);
  const {
    shareId: currentShareId,
    onOpenJoinDialog,
    onLeave,
  } = useContext(GuestEditingContext);
  const { isMac } = useContext(ElectronContext);
  const navigate = useNavigate();
  const treeRef = useRef<TreeApi<GuestShareNodeData>>(null);

  const nodes: GuestShareNodeData[] = guestShares.map((share) => ({
    id: share.shareId,
    name: share.name,
    lastOpenedAt: share.lastOpenedAt,
  }));

  const startRenaming = useCallback((shareId: string) => {
    treeRef.current?.get(shareId)?.edit();
  }, []);

  useGuestShareContextMenu({ onRename: startRenaming, onLeave });

  const handleActivate = (node: NodeApi<GuestShareNodeData>) =>
    navigate(`/shared-documents/${urlEncodeShareId(node.id)}`);

  const handleKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.target instanceof HTMLInputElement) return;

    const modKey = isMac ? ev.metaKey : ev.ctrlKey;
    const isLeaveKey = ev.key === 'Backspace' && modKey;
    const isRenameKey = isMac ? ev.key === 'Enter' : ev.key === 'F2';
    const focused = treeRef.current?.focusedNode ?? null;

    if ((!isLeaveKey && !isRenameKey) || !focused) return;

    ev.preventDefault();
    ev.stopPropagation();

    if (isLeaveKey) onLeave(focused.id);
    else focused.edit();
  };

  return (
    <div
      className="flex h-full flex-col items-stretch py-6"
      data-testid="guest-shares"
    >
      <div className="flex items-center px-4 pb-4">
        <SidebarHeading icon={GroupIcon} text="Shared with me" />
      </div>
      {guestShares.length === 0 ? (
        <EmptyView onJoinButtonClick={onOpenJoinDialog} />
      ) : (
        <div
          className="flex-1 overflow-hidden"
          onKeyDownCapture={handleKeyDown}
        >
          <AutoSizedTree
            treeRef={treeRef}
            data={nodes}
            selection={currentShareId ?? undefined}
            rowHeight={TREE_ROW_HEIGHT}
            disableDrag
            disableDrop
            disableMultiSelection
            onActivate={handleActivate}
            onRename={({ id, name }) =>
              labelShare({ shareId: id, label: name })
            }
          >
            {GuestShareNode}
          </AutoSizedTree>
        </div>
      )}
    </div>
  );
};
