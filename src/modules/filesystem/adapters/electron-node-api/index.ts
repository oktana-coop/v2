import { dialog } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

import { filesystemItemTypes } from '../../constants/filesystemItemTypes';
import { Filesystem } from '../../ports/filesystem';
import { File } from '../../types';

export const adapter: Filesystem = {
  openDirectory: async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });

    if (result.canceled) {
      // TODO: Handle more gracefully with typed errors
      throw new Error('Open directory process cancelled');
    }

    // Get directory path and name
    const directoryPath = result.filePaths[0];
    const name = path.basename(directoryPath);

    return {
      type: filesystemItemTypes.DIRECTORY,
      name,
      path: directoryPath,
      permissionState: 'granted', // TODO: Replace with constant
    };
  },
  getDirectory: async (directoryPath: string) => {
    const name = path.basename(directoryPath);

    return {
      type: filesystemItemTypes.DIRECTORY,
      name,
      path: directoryPath,
      permissionState: 'granted', // TODO: Replace with constant
    };
  },
  listDirectoryFiles: async (directoryPath: string) => {
    try {
      // Read directory contents with Dirent objects
      const dirEntries = await fs.readdir(directoryPath, {
        withFileTypes: true,
      });

      // Filter out only files (excluding directories)
      const files = dirEntries
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const file: File = {
            type: filesystemItemTypes.FILE,
            name: entry.name,
            path: path.join(directoryPath, entry.name),
          };

          return file;
        });

      return files;
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
  requestPermissionForDirectory: async () => {
    return 'granted';
  },
  createNewFile: async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      filters: [{ name: 'v2 Files', extensions: ['v2'] }],
    });

    if (canceled) {
      // TODO: Handle more gracefully with typed errors
      throw new Error('Save file process cancelled');
    }

    try {
      const initialContent = '';
      await fs.writeFile(filePath, initialContent, 'utf8');
      const name = path.basename(filePath);

      return {
        type: filesystemItemTypes.FILE,
        path: filePath,
        name,
        content: initialContent,
      };
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
  writeFile: async (filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content);
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
  readFile: async (filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      return {
        type: filesystemItemTypes.FILE,
        name: path.basename(filePath),
        path: filePath,
        content,
      };
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
};
