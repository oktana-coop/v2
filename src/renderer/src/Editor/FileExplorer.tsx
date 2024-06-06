import React from 'react';
import { clsx } from 'clsx';
import { AutomergeUrl } from '@automerge/automerge-repo';

import { FolderIcon } from '../components/icons';
import { SidebarHeading } from '../components/sidebar/SidebarHeading';
import { Button } from '../components/actions/Button';
import { readFile } from '../filesystem';

export const FileExplorer = ({
  directoryHandle,
  files,
  setDirectoryHandle,
  setDirectoryPermissionState,
  onFileSelection,
  directoryPermissionState,
}: {
  directoryPermissionState: PermissionState | null;
  directoryHandle: FileSystemDirectoryHandle | null;
  files: Array<{ filename: string; handle: FileSystemFileHandle }>;
  setDirectoryPermissionState: (
    directoryPermissionState: PermissionState
  ) => void;
  setDirectoryHandle: (directoryHandle: FileSystemDirectoryHandle) => void;
  onFileSelection: (
    docUrl: AutomergeUrl,
    fileHandle: FileSystemFileHandle
  ) => void;
}) => {
  const [selectedFilename, setSelectedFilename] = React.useState<string>('');

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
    setSelectedFilename(fileHandle.name);
    return onFileSelection(fileContent.docUrl, fileHandle);
  }

  return (
    <div className="flex flex-col h-full">
      <SidebarHeading icon={FolderIcon} text="File Explorer" />
      {directoryHandle && directoryPermissionState === 'granted' ? (
        <>
          <div className="w-48 text-left pt-2 text-black font-bold truncate">
            {directoryHandle.name}
          </div>
          <div className="max-h-96 w-48 text-black flex flex-col">
            {files.map((file) => (
              <button
                key={file.filename}
                className={clsx(
                  'truncate px-2 py-1 text-left hover:bg-zinc-950/5',
                  file.filename === selectedFilename
                    ? 'text-purple-500 dark:text-purple-300'
                    : ''
                )}
                title={file.filename}
                onClick={async () => handleOnClick(file.handle)}
              >
                {file.filename}
              </button>
            ))}
          </div>
        </>
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
