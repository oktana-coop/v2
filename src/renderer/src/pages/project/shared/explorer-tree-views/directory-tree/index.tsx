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
  onCreateDirectory,
  onCancelCreateDirectory,
  onStartRenameDocument,
  onRenameDocument,
  onCancelRenameDocument,
  onClearRenameDocumentError,
  filePathToRename,
  renameDocumentError,
  onStartRenameDirectory,
  onRenameDirectory,
  onCancelRenameDirectory,
  onClearRenameDirectoryError,
  directoryPathToRename,
  renameDirectoryError,
  onStartDeleteDocument,
  onStartDeleteDirectory,
  onCreateNewFile,
}: {
  directory: Directory | null;
  data: ExplorerTreeNode[];
  selection: string | null;
  onCreateDocument: () => void;
  onSelectItem: (id: string) => Promise<void>;
  onCreateDirectory: (name: string) => Promise<void>;
  onCancelCreateDirectory: () => void;
  onStartRenameDocument: (path: string) => void;
  onRenameDocument: (oldPath: string, newName: string) => Promise<void>;
  onCancelRenameDocument: () => void;
  onClearRenameDocumentError: () => void;
  filePathToRename: string | null;
  renameDocumentError: string | null;
  onStartRenameDirectory: (path: string) => void;
  onRenameDirectory: (oldPath: string, newName: string) => Promise<void>;
  onCancelRenameDirectory: () => void;
  onClearRenameDirectoryError: () => void;
  directoryPathToRename: string | null;
  renameDirectoryError: string | null;
  onStartDeleteDocument: (path: string) => void;
  onStartDeleteDirectory: (path: string) => void;
  onCreateNewFile?: (parentPath?: string) => Promise<void>;
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
          onCreateDirectory={onCreateDirectory}
          onCancelCreateDirectory={onCancelCreateDirectory}
          onStartRenameDocument={onStartRenameDocument}
          onRenameDocument={onRenameDocument}
          onCancelRenameDocument={onCancelRenameDocument}
          onClearRenameDocumentError={onClearRenameDocumentError}
          filePathToRename={filePathToRename}
          renameDocumentError={renameDocumentError}
          onStartRenameDirectory={onStartRenameDirectory}
          onRenameDirectory={onRenameDirectory}
          onCancelRenameDirectory={onCancelRenameDirectory}
          onClearRenameDirectoryError={onClearRenameDirectoryError}
          directoryPathToRename={directoryPathToRename}
          renameDirectoryError={renameDirectoryError}
          onStartDeleteDocument={onStartDeleteDocument}
          onStartDeleteDirectory={onStartDeleteDirectory}
          onCreateNewFile={onCreateNewFile}
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
  const { directory } = useContext(MultiDocumentProjectContext);
  const handleDocumentSelection = useDocumentSelectionInMultiDocumentProject();
  const {
    explorerTree: documents,
    canShowTree,
    selection,
    createDirectory,
    cancelCreateDirectory,
    filePathToRename,
    startRenameDocument,
    renameDocumentError,
    clearRenameDocumentError,
    renameDocument,
    cancelRenameDocument,
    directoryPathToRename,
    startRenameDirectory,
    renameDirectoryError,
    clearRenameDirectoryError,
    renameDirectory,
    cancelRenameDirectory,
    startDeleteDocument,
    startDeleteDirectory,
  } = useDocumentExplorerTree();
  const { canCreateDocument, triggerDocumentCreationDialog } =
    useCreateDocument();

  const handleRenameDocument = (oldPath: string, newName: string) =>
    renameDocument({ oldRelativePath: oldPath, newName });

  const handleRenameDirectory = (oldPath: string, newName: string) =>
    renameDirectory({ oldRelativePath: oldPath, newName });

  const handleCreateNewFile = (parentPath: string | undefined) =>
    triggerDocumentCreationDialog({ parentPath });

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
          onCreateDirectory={createDirectory}
          onCancelCreateDirectory={cancelCreateDirectory}
          onStartRenameDocument={startRenameDocument}
          onRenameDocument={handleRenameDocument}
          onCancelRenameDocument={cancelRenameDocument}
          onClearRenameDocumentError={clearRenameDocumentError}
          filePathToRename={filePathToRename}
          renameDocumentError={renameDocumentError}
          onStartRenameDirectory={startRenameDirectory}
          onRenameDirectory={handleRenameDirectory}
          onCancelRenameDirectory={cancelRenameDirectory}
          onClearRenameDirectoryError={clearRenameDirectoryError}
          directoryPathToRename={directoryPathToRename}
          renameDirectoryError={renameDirectoryError}
          onStartDeleteDocument={startDeleteDocument}
          onStartDeleteDirectory={startDeleteDirectory}
          onCreateNewFile={handleCreateNewFile}
        />
      ) : (
        <NoActiveDirectoryView />
      )}
    </div>
  );
};
