import React from 'react';
import { FileDocumentIcon } from '../components/icons';
import { readFile } from '../lib/filesystem';
import { AutomergeUrl } from '@automerge/automerge-repo';

export const FileExplorer = ({
  setFilehandle,
  setDocUrl,
}: {
  setFilehandle: React.Dispatch<
    React.SetStateAction<FileSystemFileHandle | null>
  >;
  setDocUrl: React.Dispatch<React.SetStateAction<AutomergeUrl>>;
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
      <FileDocumentIcon
        className="hover:bg-zinc-950/5 text-purple-500 dark:text-purple-300 cursor-pointer"
        onClick={async () => await getFiles()}
      />

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
    </div>
  );
};
