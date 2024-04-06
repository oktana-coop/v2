import React from 'react';
import { FileDocumentIcon } from '../components/icons';

export const FileExplorer = () => {
  const [files, setFiles] = React.useState<
    Array<{ filename: string; handler: FileSystemFileHandle }>
  >([]);
  const [directory, setDirectory] = React.useState<string>('');

  async function getFiles() {
    const dirHandle = await window.showDirectoryPicker();
    const files = [];

    setDirectory(`${dirHandle.name}/`);

    for await (const [key, value] of dirHandle.entries()) {
      if (value.kind === 'file') {
        files.push({ filename: key, handler: value });
      }
    }

    setFiles(files);
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
      <div className="max-h-96 w-48 text-black">
        {files.map((file) => (
          <div
            key={file.filename}
            className="truncate px-2 py-1 text-left"
            title={file.filename}
          >
            {file.filename}
          </div>
        ))}
      </div>
    </div>
  );
};
