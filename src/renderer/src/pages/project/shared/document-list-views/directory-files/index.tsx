import { useContext } from 'react';

import { type Directory } from '../../../../../../../modules/infrastructure/filesystem';
import { MultiDocumentProjectContext } from '../../../../../app-state';
import { IconButton } from '../../../../../components/actions/IconButton';
import { FolderIcon, PlusIcon } from '../../../../../components/icons';
import { SidebarHeading } from '../../../../../components/sidebar/SidebarHeading';
import {
  type DocumentListItem,
  useCreateDocument,
  useDocumentList,
} from '../../../../../hooks';
import { useDocumentSelection as useDocumentSelectionInMultiDocumentProject } from '../../../../../hooks/multi-document-project';
import { DocumentList } from '../DocumentList';
import { EmptyView } from './EmptyView';
import { NoActiveDirectoryView } from './NoActiveDirectoryView';

const DirectoryFilesList = ({
  directory,
  documents,
  onCreateDocument,
  onSelectItem,
}: {
  directory: Directory | null;
  documents: DocumentListItem[];
  onCreateDocument: () => void;
  onSelectItem: (id: string) => Promise<void>;
}) => {
  if (documents.length > 0) {
    return (
      <div className="flex flex-col items-stretch overflow-auto">
        <div className="mb-1 truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
          {directory?.name ?? 'Files'}
        </div>
        <DocumentList items={documents} onSelectItem={onSelectItem} />
      </div>
    );
  }

  return <EmptyView onCreateDocumentButtonClick={onCreateDocument} />;
};

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
        <DirectoryFilesList
          directory={directory}
          documents={documents}
          onCreateDocument={onCreateDocument}
          onSelectItem={handleDocumentSelection}
        />
      ) : (
        <NoActiveDirectoryView />
      )}
    </div>
  );
};
