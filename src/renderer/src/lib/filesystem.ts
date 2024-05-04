import { FileContent } from '../types';
import { AutomergeUrl } from '@automerge/automerge-repo';

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

async function verifyPermission(
  fileHandle: FileSystemFileHandle
  // readWrite
) {
  const options: FileSystemHandlePermissionDescriptor = {};

  // if (readWrite) {
  options.mode = 'readwrite';
  // }
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
    const fileHandle = await window.showSaveFilePicker();

    // Create a writable stream to the file
    const writable = await fileHandle.createWritable();

    // Write initial content to the file
    await writable.write(JSON.stringify({ docUrl, value: '' }));

    // Close the writable stream
    await writable.close();

    console.log('File created successfully!');
  } catch (error) {
    console.error('Error creating file:', error);
  }
}
