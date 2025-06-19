import { useContext } from 'react';

import { CurrentDocumentContext } from '../../../../../../../modules/app-state';
import { MultiDocumentProjectContext } from '../../../../../../../modules/app-state';
import { removeExtension } from '../../../../../../../modules/infrastructure/filesystem';
import { IconButton } from '../../../../../components/actions/IconButton';
import { FolderIcon, PlusIcon } from '../../../../../components/icons';
import { SidebarHeading } from '../../../../../components/sidebar/SidebarHeading';
import { useDocumentSelection as useDocumentSelectionInMultiDocumentProject } from '../../../../../hooks/multi-document-project';
import { DocumentList } from '../DocumentList';
import { NoActiveDirectoryView } from './NoActiveDirectoryView';

export const DirectoryFiles = ({
  onCreateDocument,
}: {
  onCreateDocument: () => void;
}) => {
  const { directory, directoryFiles, canCreateDocument, canShowFiles } =
    useContext(MultiDocumentProjectContext);
  const { selectedFileInfo } = useContext(CurrentDocumentContext);
  const handleDocumentSelection = useDocumentSelectionInMultiDocumentProject();

  const files = directoryFiles.map((file) => ({
    id: file.path!,
    name: removeExtension(file.name),
    isSelected: selectedFileInfo?.path === file.path,
  }));

  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={FolderIcon} text="File Explorer" />
        </div>
        <div className="flex gap-1">
          {canCreateDocument() && (
            <IconButton
              onClick={onCreateDocument}
              icon={<PlusIcon size={20} />}
            />
          )}
        </div>
      </div>

      {canShowFiles() ? (
        <div className="flex flex-col items-stretch overflow-auto">
          <div className="mb-1 truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
            {directory?.name ?? 'Files'}
          </div>
          <DocumentList items={files} onSelectItem={handleDocumentSelection} />
        </div>
      ) : (
        <NoActiveDirectoryView />
      )}
    </div>
  );
};
