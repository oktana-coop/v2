import { useContext } from 'react';

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
import { TreeView } from '../tree';
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
  if (data.length > 0) {
    return (
      <div className="flex h-full flex-col items-stretch overflow-hidden">
        <div className="mb-1 flex-initial">
          <h3 className="truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
            {directory?.name ?? 'Files'}
          </h3>
        </div>
        <TreeView
          data={data}
          selection={selection}
          onSelectItem={onSelectItem}
        />
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
  const { directory, openDirectory } = useContext(MultiDocumentProjectContext);
  const handleDocumentSelection = useDocumentSelectionInMultiDocumentProject();
  const {
    explorerTree: documents,
    canShowTree,
    selection,
  } = useDocumentExplorerTree();
  const { canCreateDocument } = useCreateDocument();

  return (
    <div
      className="flex h-full flex-col items-stretch py-6"
      data-testid="file-explorer"
    >
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={FolderIcon} text="File Explorer" />
        </div>
        <div className="flex gap-1">
          <IconButton
            onClick={() => openDirectory()}
            icon={<FolderIcon size={20} />}
            tooltip="Open Folder"
          />
          {canCreateDocument && (
            <IconButton
              onClick={onCreateDocument}
              icon={<PlusIcon size={20} />}
              tooltip="New Document"
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
