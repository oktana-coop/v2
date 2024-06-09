import { clsx } from 'clsx';
import { AutomergeUrl } from '@automerge/automerge-repo';

import { FileDocumentIcon, FolderIcon } from '../../components/icons';
import { SidebarHeading } from '../../components/sidebar/SidebarHeading';
import { Button } from '../../components/actions/Button';
import { readFile, removeExtension } from '../../filesystem';

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
    <div className="flex flex-col items-stretch py-6 h-full">
      <div className="px-4">
        <SidebarHeading icon={FolderIcon} text="File Explorer" />
      </div>

      {directoryHandle && directoryPermissionState === 'granted' ? (
        <div className="flex flex-col items-stretch">
          <div className="px-4 mb-1 text-left text-black dark:text-white text-opacity-85 dark:text-opacity-85 font-bold truncate">
            {directoryHandle.name}
          </div>
          <ul className="text-black dark:text-white flex flex-col items-stretch">
            {files.map((file) => (
              <li
                className={clsx(
                  'py-1 pl-9 pr-4 hover:bg-zinc-950/5 dark:hover:bg-white/5',
                  file.filename === selectedFileHandle?.name
                    ? 'bg-purple-50 dark:bg-neutral-600'
                    : ''
                )}
              >
                <button
                  key={file.filename}
                  className="w-full truncate text-left bg-transparent flex items-center"
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
        <div className="flex items-center justify-center h-full">
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
