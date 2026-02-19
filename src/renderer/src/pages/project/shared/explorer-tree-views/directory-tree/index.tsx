import { useContext } from 'react';
import { NodeApi, Tree } from 'react-arborist';
import { AutoSizer } from 'react-virtualized-auto-sizer';

import { type Directory } from '../../../../../../../modules/infrastructure/filesystem';
import { MultiDocumentProjectContext } from '../../../../../app-state';
import { IconButton } from '../../../../../components/actions/IconButton';
import { FolderIcon, PlusIcon } from '../../../../../components/icons';
import { SidebarHeading } from '../../../../../components/sidebar/SidebarHeading';
import {
  type ExplorerTreeNode,
  useCreateDocument,
  useDocumentExplorerTree,
} from '../../../../../hooks';
import { useDocumentSelection as useDocumentSelectionInMultiDocumentProject } from '../../../../../hooks/multi-document-project';
import { TreeNode } from '../TreeNode';
import { EmptyView } from './EmptyView';
import { NoActiveDirectoryView } from './NoActiveDirectoryView';

const DirectoryTree = ({
  directory,
  data,
  selection,
  onCreateDocument,
  onSelectItem,
}: {
  directory: Directory | null;
  data: ExplorerTreeNode[];
  selection: string | null;
  onCreateDocument: () => void;
  onSelectItem: (id: string) => Promise<void>;
}) => {
  const handleSelect = (nodes: NodeApi<ExplorerTreeNode>[]) => {
    if (nodes.length > 0) {
      onSelectItem(nodes[0].data.id);
    }
  };

  if (data.length > 0) {
    return (
      <div className="flex flex-col items-stretch overflow-auto">
        <div className="mb-1 truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
          {directory?.name ?? 'Files'}
        </div>
        <div className="flex-auto">
          <AutoSizer
            renderProp={({ width, height }) => (
              <Tree
                data={data}
                onSelect={handleSelect}
                selection={selection ?? undefined}
                width={width ?? '100%'}
                height={height}
                rowHeight={32}
              >
                {TreeNode}
              </Tree>
            )}
          />
        </div>
      </div>
    );
  }

  return <EmptyView onCreateDocumentButtonClick={onCreateDocument} />;
};

export const DirectoryTreeView = ({
  onCreateDocument,
}: {
  onCreateDocument: () => void;
}) => {
  const { directory } = useContext(MultiDocumentProjectContext);
  const handleDocumentSelection = useDocumentSelectionInMultiDocumentProject();
  const {
    explorerTree: documents,
    canShowTree,
    selection,
  } = useDocumentExplorerTree();
  const { canCreateDocument } = useCreateDocument();

  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={FolderIcon} text="File Explorer" />
        </div>
        <div className="flex gap-1">
          {canCreateDocument && (
            <IconButton
              onClick={onCreateDocument}
              icon={<PlusIcon size={20} />}
            />
          )}
        </div>
      </div>

      {canShowTree ? (
        <DirectoryTree
          directory={directory}
          data={documents}
          selection={selection}
          onCreateDocument={onCreateDocument}
          onSelectItem={handleDocumentSelection}
        />
      ) : (
        <NoActiveDirectoryView />
      )}
    </div>
  );
};
