import { useContext } from 'react';

import { MultiDocumentProjectContext } from '../../../../../../../modules/app-state';
import { IconButton } from '../../../../../components/actions/IconButton';
import { FolderIcon, PlusIcon } from '../../../../../components/icons';
import { SidebarHeading } from '../../../../../components/sidebar/SidebarHeading';
import { useCreateDocument, useDocumentList } from '../../../../../hooks';
import { useDocumentSelection as useDocumentSelectionInMultiDocumentProject } from '../../../../../hooks/multi-document-project';
import { DocumentList } from '../DocumentList';
import { NoActiveDirectoryView } from './NoActiveDirectoryView';

export const DirectoryFiles = ({
  onCreateDocument,
}: {
  onCreateDocument: () => void;
}) => {
  const { directory } = useContext(MultiDocumentProjectContext);
  const handleDocumentSelection = useDocumentSelectionInMultiDocumentProject();
  const { documentList: documents, canShowList } = useDocumentList();
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
        <div className="flex flex-col items-stretch overflow-auto">
          <div className="mb-1 truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
            {directory?.name ?? 'Files'}
          </div>
          <DocumentList
            items={documents}
            onSelectItem={handleDocumentSelection}
          />
        </div>
      ) : (
        <NoActiveDirectoryView />
      )}
    </div>
  );
};
