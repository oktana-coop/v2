import { useContext } from 'react';
import { NodeApi, Tree } from 'react-arborist';

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
import { EmptyView } from './EmptyView';
import { NoActiveDirectoryView } from './NoActiveDirectoryView';

const DirectoryTree = ({
  directory,
  data,
  onCreateDocument,
  onSelectItem,
}: {
  directory: Directory | null;
  data: ExplorerTreeNode[];
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
        <Tree data={data} onSelect={handleSelect} />
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
  const { explorerTree: documents, canShowTree } = useDocumentExplorerTree();
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
          onCreateDocument={onCreateDocument}
          onSelectItem={handleDocumentSelection}
        />
      ) : (
        <NoActiveDirectoryView />
      )}
    </div>
  );
};
