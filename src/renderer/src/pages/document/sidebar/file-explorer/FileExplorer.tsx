import { useContext } from 'react';

import {
  CurrentDocumentContext,
  CurrentProjectContext,
} from '../../../../../../modules/app-state';
import { projectTypes } from '../../../../../../modules/domain/project';
import { IconButton } from '../../../../components/actions/IconButton';
import { FolderIcon, PlusIcon } from '../../../../components/icons';
import { SidebarHeading } from '../../../../components/sidebar/SidebarHeading';
import { useFileSelection as useFileSelectionInMultiDocumentProject } from '../../../../hooks/multi-document-project';
import { useFileSelection as useFileSelectionInSingleDocumentProject } from '../../../../hooks/single-document-project';
import { FileList } from './FileList';
import {
  MultiDocumentProjectFileExplorerTitle,
  NoActiveDirectoryView,
} from './multi-document-project';

export const FileExplorer = ({
  onCreateDocument,
}: {
  onCreateDocument: () => void;
}) => {
  const { projectType, files, canCreateDocument, canShowFiles } = useContext(
    CurrentProjectContext
  );
  const { selectedFileInfo } = useContext(CurrentDocumentContext);
  const handleFileSelectionInMultiDocumentProject =
    useFileSelectionInMultiDocumentProject();
  const handleFileSelectionInSingleDocumentProject =
    useFileSelectionInSingleDocumentProject();

  const handleFileSelection =
    projectType === projectTypes.MULTI_DOCUMENT_PROJECT
      ? handleFileSelectionInMultiDocumentProject
      : handleFileSelectionInSingleDocumentProject;

  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center justify-between px-4 pb-4">
        <SidebarHeading icon={FolderIcon} text="File Explorer" />
        {canCreateDocument() && (
          <IconButton
            onClick={onCreateDocument}
            icon={<PlusIcon size={20} />}
          ></IconButton>
        )}
      </div>

      {canShowFiles() ? (
        <div className="flex flex-col items-stretch overflow-auto">
          <div className="mb-1 truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
            {projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
              <MultiDocumentProjectFileExplorerTitle />
            ) : (
              'Recent Files'
            )}
          </div>
          <FileList
            files={files}
            onFileSelection={handleFileSelection}
            selectedFileInfo={selectedFileInfo}
          />
        </div>
      ) : projectType === projectTypes.MULTI_DOCUMENT_PROJECT ? (
        <NoActiveDirectoryView />
      ) : null}
    </div>
  );
};
