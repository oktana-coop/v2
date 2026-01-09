import { useEffect, useState } from 'react';

import { removeExtension } from '../../../../../../modules/infrastructure/filesystem';
import { DiffIcon, MergeIcon } from '../../../../components/icons';
import { SidebarHeading } from '../../../../components/sidebar/SidebarHeading';
import { useMergeConflictInfo } from '../../../../hooks';
import {
  DocumentList,
  type DocumentListItem,
} from '../../shared/document-list-views/DocumentList';
import { EmptyView } from './EmptyView';

export const MergeConflictsList = () => {
  const [documentsList, setDocumentsList] = useState<DocumentListItem[]>([]);

  const { compareContentConflicts, structuralConflicts } =
    useMergeConflictInfo();

  useEffect(() => {
    if (compareContentConflicts.length > 0) {
      const docList = compareContentConflicts.map((conflict) => ({
        id: conflict.path,
        name: removeExtension(conflict.path),
        isSelected: false,
      }));

      setDocumentsList(docList);
    }
  }, [compareContentConflicts]);

  const handleSelectDocumentConflict = async (id: string) => {
    console.log(id);
  };

  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center px-4 pb-4">
        <div className="flex-auto">
          <SidebarHeading icon={MergeIcon} text="File Explorer" />
        </div>
      </div>

      {documentsList.length > 0 ? (
        <div className="flex flex-col items-stretch overflow-auto">
          <div className="mb-1 truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
            Merge Conflicts
          </div>
          <DocumentList
            items={documentsList}
            onSelectItem={handleSelectDocumentConflict}
          />
        </div>
      ) : (
        <EmptyView />
      )}
    </div>
  );
};
