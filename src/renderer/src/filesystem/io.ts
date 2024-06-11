import { AutomergeUrl } from '@automerge/automerge-repo';

import { FileContent } from '../types';
import { FILE_EXTENSION } from './constants';

export async function writeFile(
  fileHandle: FileSystemFileHandle,
  fileContent: FileContent
) {
  const canWrite = await verifyPermission(fileHandle);

  if (!canWrite) {
    return;
  }

  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(fileContent));
  await writable.close();
}

export async function readFile(
  fileHandle: FileSystemFileHandle
): Promise<FileContent> {
  const file = await fileHandle.getFile();
  return JSON.parse(await file.text());
}

async function verifyPermission(fileHandle: FileSystemFileHandle) {
  const options: FileSystemHandlePermissionDescriptor = {};
  options.mode = 'readwrite';

  // Check if permission was already granted. If so, return true.
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }

  // Request permission. If the user grants permission, return true.
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }

  // The user didn't grant permission, so return false.
  return false;
}

export async function createNewFile(docUrl: AutomergeUrl) {
  try {
    // Prompt the user to select where to save the file
    const fileHandle = await window.showSaveFilePicker({
      excludeAcceptAllOption: true,
      types: [
        {
          description: 'v2',
          accept: {
            'application/v2': [FILE_EXTENSION],
          },
        },
      ],
    });

    const writable = await fileHandle.createWritable();

    // Write initial content to the file
    await writable.write(JSON.stringify({ docUrl, value: '' }));

    await writable.close();

    console.info('File created successfully!');

    return fileHandle;
  } catch (error) {
    console.error('Error creating file:', error);
  }
}

export async function getFiles(dirHandle: FileSystemDirectoryHandle) {
  const files = [];

  for await (const [key, value] of dirHandle.entries()) {
    if (value.kind === 'file' && value.name.endsWith(FILE_EXTENSION)) {
      files.push({ filename: key, handle: value });
    }
  }

  return files;
}
