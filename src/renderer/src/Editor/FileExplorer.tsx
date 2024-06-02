import React, { useEffect } from 'react';
import { readFile, getFiles } from '../filesystem/io';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { FolderIcon } from '../components/icons';
import { SidebarHeading } from '../components/sidebar/SidebarHeading';
import { Button } from '../components/actions/Button';
import { clsx } from 'clsx';

export const FileExplorer = ({
  directoryHandle,
  setFilehandle,
  setDirectoryHandle,
  setDirectoryPermissionState,
  onFileSelection,
  directoryPermissionState,
}: {
  directoryPermissionState: PermissionState | null;
  directoryHandle: FileSystemDirectoryHandle | null;
  setFilehandle: React.Dispatch<
    React.SetStateAction<FileSystemFileHandle | null>
  >;
  setDirectoryPermissionState: (
    directoryPermissionState: PermissionState
  ) => void;
  setDirectoryHandle: (directoryHandle: FileSystemDirectoryHandle) => void;
  onFileSelection: (directoryName: string, docUrl: AutomergeUrl) => void;
}) => {
  const [files, setFiles] = React.useState<
    Array<{ filename: string; handle: FileSystemFileHandle }>
  >([]);
  const [selectedFilename, setSelectedFilename] = React.useState<string>('');

  useEffect(() => {
    const getDirectoryFiles = async (
      directoryHandle: FileSystemDirectoryHandle
    ) => {
      const files = await getFiles(directoryHandle);
      setFiles(files);
    };

    if (directoryHandle && directoryPermissionState === 'granted') {
      getDirectoryFiles(directoryHandle);
    }
  }, [directoryHandle, directoryPermissionState]);

  const openFolder = async () => {
    const dirHandle = await window.showDirectoryPicker();
    setDirectoryHandle(dirHandle);
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
    setFilehandle(fileHandle);
    if (directoryHandle) {
      return onFileSelection(directoryHandle?.name, fileContent.docUrl);
    }
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
                : await openFolder()
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
