import { IconButton } from '../../../../../components/actions/IconButton';
import {
  FileDocumentIcon,
  FolderIcon,
  PlusIcon,
} from '../../../../../components/icons';
import { SidebarHeading } from '../../../../../components/sidebar/SidebarHeading';
import { useDocumentList } from '../../../../../hooks';
import {
  useDocumentSelection as useDocumentSelectionInSingleDocumentProject,
  useOpenDocument,
} from '../../../../../hooks/single-document-project';
import { DocumentList } from '../DocumentList';

export const RecentProjects = ({
  onCreateDocument,
}: {
  onCreateDocument: () => void;
}) => {
  const selectDocument = useDocumentSelectionInSingleDocumentProject();
  const openDocument = useOpenDocument();
  const items = useDocumentList();
  const handleOpenDocument = () => openDocument();

  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={FolderIcon} text="File Explorer" />
        </div>
        <div className="flex gap-1">
          <IconButton
            onClick={handleOpenDocument}
            icon={<FileDocumentIcon size={20} />}
          />
          <IconButton
            onClick={onCreateDocument}
            icon={<PlusIcon size={20} />}
          />
        </div>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-col items-stretch overflow-auto">
          <div className="mb-1 truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
            Recent Documents
          </div>
          <DocumentList items={items} onSelectItem={selectDocument} />
        </div>
      ) : null}
    </div>
  );
};
