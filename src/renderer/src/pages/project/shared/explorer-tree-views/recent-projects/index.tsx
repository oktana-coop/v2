import { useContext } from 'react';

import { ElectronContext } from '../../../../../../../modules/infrastructure/cross-platform/browser';
import { CloneFromGithubModalContext } from '../../../../../app-state';
import { IconButton } from '../../../../../components/actions/IconButton';
import {
  FileDocumentIcon,
  FolderIcon,
  PlusIcon,
} from '../../../../../components/icons';
import { SidebarHeading } from '../../../../../components/sidebar/SidebarHeading';
import { useDocumentExplorerTree } from '../../../../../hooks';
import {
  useDocumentSelection as useDocumentSelectionInSingleDocumentProject,
  useOpenDocument,
} from '../../../../../hooks/single-document-project';
import { TreeView } from '../tree';
import { EmptyView } from './EmptyView';

export const RecentProjects = ({
  onCreateDocument,
}: {
  onCreateDocument: () => void;
}) => {
  const { isElectron } = useContext(ElectronContext);
  const { openCloneFromGithubModal } = useContext(CloneFromGithubModalContext);

  const selectDocument = useDocumentSelectionInSingleDocumentProject();
  const openDocument = useOpenDocument();
  const { explorerTree: items, selection } = useDocumentExplorerTree();
  const handleOpenDocument = () => openDocument();
  const handleCreateDocument = () => onCreateDocument();

  const handleCloneFromGithub = () => {
    openCloneFromGithubModal();
  };

  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={FolderIcon} text="File Explorer" />
        </div>
        <div className="flex gap-1">
          {isElectron && (
            <IconButton
              onClick={handleOpenDocument}
              icon={<FileDocumentIcon size={20} />}
              tooltip="Open Document"
            />
          )}

          <IconButton
            onClick={handleCreateDocument}
            icon={<PlusIcon size={20} />}
            tooltip="New Document"
          />
        </div>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-col items-stretch overflow-auto">
          <h3 className="truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
            Recent Documents
          </h3>
          <TreeView
            data={items}
            selection={selection}
            onSelectItem={selectDocument}
          />
        </div>
      ) : (
        <EmptyView
          onCreateDocumentButtonClick={handleCreateDocument}
          onOpenDocumentButtonClick={handleOpenDocument}
          onCloneFromGithubButtonClick={handleCloneFromGithub}
        />
      )}
    </div>
  );
};
