import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../../../../../app-state';
import { IconButton } from '../../../../../components/actions/IconButton';
import { FileTree } from '../../../../../components/file-tree/FileTree';
import { FolderIcon, PlusIcon } from '../../../../../components/icons';
import { SidebarHeading } from '../../../../../components/sidebar/SidebarHeading';
import { useCreateDocument, useDocumentList } from '../../../../../hooks';
import { useDocumentSelection as useDocumentSelectionInMultiDocumentProject } from '../../../../../hooks/multi-document-project';
import { EmptyView } from './EmptyView';
import { NoActiveDirectoryView } from './NoActiveDirectoryView';

export const DirectoryFiles = ({
  onCreateDocument,
}: {
  onCreateDocument: () => void;
}) => {
  const { directory, directoryFiles, selectedFileInfo } = useContext(
    MultiDocumentProjectContext
  );
  const handleDocumentSelection = useDocumentSelectionInMultiDocumentProject();
  const { canShowList } = useDocumentList();
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

      {canShowList ? (
        directoryFiles.length > 0 ? (
          <div className="flex flex-col items-stretch overflow-auto">
            <div className="mb-1 truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
              {directory?.name ?? 'Files'}
            </div>
            <FileTree
              files={directoryFiles}
              directoryName={directory?.name ?? null}
              selectedFilePath={selectedFileInfo?.path ?? null}
              onSelectItem={handleDocumentSelection}
            />
          </div>
        ) : (
          <EmptyView onCreateDocumentButtonClick={onCreateDocument} />
        )
      ) : (
        <NoActiveDirectoryView />
      )}
    </div>
  );
};
