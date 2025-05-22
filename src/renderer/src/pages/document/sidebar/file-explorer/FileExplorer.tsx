import { clsx } from 'clsx';

import { type SelectedFileInfo } from '../../../../../../modules/editor-state';
import {
  type Directory,
  type File,
  removeExtension,
} from '../../../../../../modules/filesystem';
import { Button } from '../../../../components/actions/Button';
import { IconButton } from '../../../../components/actions/IconButton';
import {
  FileDocumentIcon,
  FolderIcon,
  PlusIcon,
} from '../../../../components/icons';
import { SidebarHeading } from '../../../../components/sidebar/SidebarHeading';

export const FileExplorer = ({
  directory,
  files,
  selectedFileInfo,
  onOpenDirectory,
  onRequestPermissionsForCurrentDirectory,
  onFileSelection,
  onCreateDocument,
}: {
  directory: Directory | null;
  files: Array<File>;
  selectedFileInfo: SelectedFileInfo | null;
  onOpenDirectory: () => Promise<void>;
  onRequestPermissionsForCurrentDirectory: () => Promise<void>;
  onFileSelection: (file: File) => Promise<void>;
  onCreateDocument: () => void;
}) => {
  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="flex items-center justify-between px-4 pb-4">
        <SidebarHeading icon={FolderIcon} text="File Explorer" />
        {directory && directory.permissionState === 'granted' && (
          <IconButton
            onClick={onCreateDocument}
            icon={<PlusIcon size={20} />}
          ></IconButton>
        )}
      </div>

      {directory && directory.permissionState === 'granted' ? (
        <div className="flex flex-col items-stretch overflow-auto">
          <div className="mb-1 truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
            {directory.name}
          </div>
          <ul className="flex flex-col items-stretch text-black dark:text-white">
            {files.map((file) => (
              <li
                key={file.name}
                className={clsx(
                  'py-1 pl-9 pr-4 hover:bg-zinc-950/5 dark:hover:bg-white/5',
                  file.path === selectedFileInfo?.path
                    ? 'bg-purple-50 dark:bg-neutral-600'
                    : ''
                )}
              >
                <button
                  className="flex w-full items-center truncate bg-transparent text-left"
                  title={file.name}
                  onClick={async () => onFileSelection(file)}
                >
                  <FileDocumentIcon className="mr-1" size={16} />
                  {removeExtension(file.name)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <Button
            onClick={async () =>
              directory?.permissionState === 'prompt'
                ? await onRequestPermissionsForCurrentDirectory()
                : await onOpenDirectory()
            }
            variant="solid"
            color="purple"
          >
            <FolderIcon />
            Open Folder
          </Button>
        </div>
      )}
    </div>
  );
};
