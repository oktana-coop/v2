import { AutomergeUrl } from '@automerge/automerge-repo';
import { clsx } from 'clsx';

import { Button } from '../../components/actions/Button';
import { FileDocumentIcon, FolderIcon } from '../../components/icons';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import { readFile, removeExtension } from '../../modules/filesystem';

export const FileExplorer = ({
  directoryHandle,
  files,
  selectedFileHandle,
  setDirectoryHandle,
  setDirectoryPermissionState,
  onFileSelection,
  directoryPermissionState,
}: {
  directoryPermissionState: PermissionState | null;
  directoryHandle: FileSystemDirectoryHandle | null;
  files: Array<{ filename: string; handle: FileSystemFileHandle }>;
  selectedFileHandle: FileSystemFileHandle | null;
  setDirectoryPermissionState: (
    directoryPermissionState: PermissionState
  ) => void;
  setDirectoryHandle: (directoryHandle: FileSystemDirectoryHandle) => void;
  onFileSelection: (
    docUrl: AutomergeUrl,
    fileHandle: FileSystemFileHandle
  ) => void;
}) => {
  const openDirectory = async () => {
    const dirHandle = await window.showDirectoryPicker();
    setDirectoryHandle(dirHandle);

    // update permission state
    const perm = await dirHandle.queryPermission();
    setDirectoryPermissionState(perm);
  };

  const requestPermissions = async () => {
    if (directoryHandle) {
      const perm = await directoryHandle.requestPermission();
      setDirectoryPermissionState(perm);
    }
  };

  async function handleOnClick(fileHandle: FileSystemFileHandle) {
    const fileContent = await readFile(fileHandle);
    return onFileSelection(fileContent.docUrl, fileHandle);
  }

  return (
    <div className="flex h-full flex-col items-stretch py-6">
      <div className="px-4">
        <SidebarHeading icon={FolderIcon} text="File Explorer" />
      </div>

      {directoryHandle && directoryPermissionState === 'granted' ? (
        <div className="flex flex-col items-stretch">
          <div className="mb-1 truncate px-4 text-left font-bold text-black text-opacity-85 dark:text-white dark:text-opacity-85">
            {directoryHandle.name}
          </div>
          <ul className="flex flex-col items-stretch text-black dark:text-white">
            {files.map((file) => (
              <li
                key={file.filename}
                className={clsx(
                  'py-1 pl-9 pr-4 hover:bg-zinc-950/5 dark:hover:bg-white/5',
                  file.filename === selectedFileHandle?.name
                    ? 'bg-purple-50 dark:bg-neutral-600'
                    : ''
                )}
              >
                <button
                  className="flex w-full items-center truncate bg-transparent text-left"
                  title={file.filename}
                  onClick={async () => handleOnClick(file.handle)}
                >
                  <FileDocumentIcon className="mr-1" size={16} />
                  {removeExtension(file.filename)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <Button
            onClick={async () =>
              directoryPermissionState === 'prompt'
                ? await requestPermissions()
                : await openDirectory()
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
