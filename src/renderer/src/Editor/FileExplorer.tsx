import React from 'react';
import { readFile } from '../utils/filesystem';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { FolderIcon } from '../components/icons';
import { SidebarHeading } from '../components/sidebar/SidebarHeading';
import { Button } from '../components/actions/Button';

export const FileExplorer = ({
  setFilehandle,
  setDocUrl,
}: {
  setFilehandle: React.Dispatch<
    React.SetStateAction<FileSystemFileHandle | null>
  >;
  setDocUrl: React.Dispatch<React.SetStateAction<AutomergeUrl | null>>;
}) => {
  const [files, setFiles] = React.useState<
    Array<{ filename: string; handle: FileSystemFileHandle }>
  >([]);
  const [directory, setDirectory] = React.useState<string>('');

  async function getFiles() {
    const dirHandle = await window.showDirectoryPicker();
    const files = [];

    setDirectory(`${dirHandle.name}/`);

    for await (const [key, value] of dirHandle.entries()) {
      if (value.kind === 'file') {
        files.push({ filename: key, handle: value });
      }
    }

    setFiles(files);
  }

  async function handleOnClick(fileHandle: FileSystemFileHandle) {
    const fileContent = await readFile(fileHandle);
    setDocUrl(fileContent.docUrl);
    setFilehandle(fileHandle);
  }

  return (
    <div className="flex flex-col h-full">
      <SidebarHeading icon={FolderIcon} text="File Explorer" />
      {/* <SidebarHeading icon={FolderIcon} text="File Explorer" onClick={async () => await getFiles()}> */}

      {directory ? (
        <>
          <div className="w-48 text-left pt-2 text-black font-bold truncate">
            {directory}
          </div>
          <div className="max-h-96 w-48 text-black flex flex-col">
            {files.map((file) => (
              <button
                key={file.filename}
                className="truncate px-2 py-1 text-left"
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
            onClick={async () => await getFiles()}
            variant="solid"
            color="purple"
          >
            <FolderIcon />
            Open folder
          </Button>
        </div>
      )}
    </div>
  );
};
