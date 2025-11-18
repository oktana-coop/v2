import { type Mode, type ObjectEncodingOptions, type OpenMode } from 'node:fs';
import { posix, sep } from 'node:path';

import { type Database } from 'better-sqlite3';

import { type NodeLikeFsApi, type Stats } from './types';

type DBFile = {
  path: string;
  content: Buffer;
  mode: number;
  mtime: number;
};

const createInitialSchema = (db: Database) =>
  db.exec(`
      -- Single table for all files (working directory AND .git directory)
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        content BLOB NOT NULL,
        mode INTEGER NOT NULL DEFAULT 0o100644,
        mtime INTEGER NOT NULL DEFAULT (unixepoch())
      ) STRICT

      -- Index for efficient directory listings
      CREATE INDEX IF NOT EXISTS idx_path ON files(path);
    `);

export const createAdapter = (db: Database): NodeLikeFsApi => {
  createInitialSchema(db);

  const normalizePath = (filepath: string): string => {
    const posixPath = filepath.split(sep).join(posix.sep);
    const normalized = posix.normalize(posixPath);

    // Remove leading/trailing slashes for consistency
    const cleaned = normalized.replace(/^\/+|\/+$/g, '');

    // Return '.' for root
    return cleaned === '' ? '.' : cleaned;
  };

  const readFile = async (
    // Type taken from isomorphic-git's `write` wrapper.
    // isomorphic-git uses string file paths.
    filepath: string,
    // Type taken from the respective method in Node.js.
    // isomorphic-git uses a generic object here, so it's good to narrow it down.
    options?:
      | {
          encoding?: null | undefined;
          flag?: string | undefined;
        }
      | null
      | string
  ): Promise<string | Buffer> => {
    const normalized = normalizePath(filepath);
    const stmt = db.prepare('SELECT * FROM files WHERE path = ?');
    const row = stmt.get(normalized) as DBFile | undefined;

    if (!row) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOENT: no such file or directory, open '${filepath}'`
      );
      err.code = 'ENOENT';
      throw err;
    }

    const encoding = typeof options === 'string' ? options : options?.encoding;

    if (encoding === 'utf8' || encoding === 'utf-8') {
      return row.content.toString('utf8');
    }

    return Buffer.from(row.content);
  };

  const writeFile = async (
    // Type taken from isomorphic-git's `write` wrapper.
    // isomorphic-git uses string file paths.
    filepath: string,
    // Type taken from isomorphic-git's `write` wrapper.
    data: Buffer | Uint8Array | string,
    // Type taken from the respective method in Node.js
    // isomorphic-git uses a generic object here, so it's good to narrow it down.
    options?:
      | (ObjectEncodingOptions & {
          mode?: Mode | undefined;
          flag?: OpenMode | undefined;
          flush?: boolean | undefined;
        })
      | BufferEncoding
      | null
  ): Promise<void> => {
    const normalized = normalizePath(filepath);

    const bufferFromData = (
      d: Buffer | Uint8Array | string
    ): Buffer<ArrayBufferLike> => {
      if (typeof d === 'string') {
        if (typeof options === 'string' && Buffer.isEncoding(options)) {
          return Buffer.from(d, options);
        }

        if (typeof options === 'object') {
          return Buffer.from(d, options?.encoding ?? 'utf8');
        }

        // Fallback to utf8
        return Buffer.from(d, 'utf8');
      } else if (d instanceof Uint8Array) {
        return Buffer.from(d);
      }

      // Already a Buffer
      return d;
    };

    const buffer = bufferFromData(data);
    const mode =
      typeof options === 'object' ? (options?.mode ?? 0o100644) : 0o100644;
    const mtime = Date.now();

    const stmt = db.prepare(`
          INSERT OR REPLACE INTO files (path, content, mode, mtime) 
          VALUES (?, ?, ?, ?)
        `);

    stmt.run(normalized, buffer, mode, mtime);
  };

  const unlink = async (filepath: string) => {
    const normalized = normalizePath(filepath);

    const stmt = db.prepare('DELETE FROM files WHERE path = ?');
    const result = stmt.run(normalized);

    if (result.changes === 0) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOENT: no such file or directory, unlink '${filepath}'`
      );
      err.code = 'ENOENT';
      throw err;
    }
  };

  const findFile = async (filepath: string): Promise<DBFile | undefined> => {
    return db.prepare(`SELECT 1 FROM files WHERE path = ?`).get(filepath) as
      | DBFile
      | undefined;
  };

  const readdir = async (dirpath: string) => {
    const normalizedDir = normalizePath(dirpath);

    // Check if the path exists but corresponds to a file
    const fileCheck = await findFile(normalizedDir);
    if (fileCheck) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOTDIR: not a directory, scandir '${normalizedDir}'`
      );
      err.code = 'ENOTDIR';
      throw err;
    }

    // Get all descendants
    const likePattern = normalizedDir === '.' ? '%' : `${normalizedDir}/%`;
    const rows = db
      .prepare(`SELECT path FROM files WHERE path LIKE ?`)
      .all(likePattern) as DBFile[];

    // If no rows found, the directory does not exist
    if (rows.length === 0) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOENT: no such file or directory, scandir '${normalizedDir}'`
      );
      err.code = 'ENOENT';
      throw err;
    }

    // We'll use this to slice the part and remove the dir path. In case of the root directory (.) we don't need to slice anything.
    const prefixLen = normalizedDir === '.' ? 0 : normalizedDir.length + 1;

    const directChildrenSet = new Set(
      rows
        .map(
          (row) =>
            row.path
              // This is essentially the relative path of the file to the directory
              .slice(prefixLen)
              // The first segment of the relative path corresponds to an immediate child
              // (keep in mind that we are also handling files in sub-directories here)
              .split('/')[0]
        )
        .filter((segment) => segment.length > 0)
    );

    return Array.from(directChildrenSet);
  };

  // SQLite doesn't need explicit directory creation. Directories are implicit from file paths.
  // This is a no-op but required by isomorphic-git.
  const mkdir = async () => {};

  const rmdir = async (dirpath: string) => {
    const normalizedDir = normalizePath(dirpath);

    // Check if the path exists but corresponds to a file
    const fileCheck = await findFile(normalizedDir);
    if (fileCheck) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOTDIR: not a directory, scandir '${normalizedDir}'`
      );
      err.code = 'ENOTDIR';
      throw err;
    }

    // Delete all descendants
    const likePattern = normalizedDir === '.' ? '%' : `${normalizedDir}/%`;
    const result = db
      .prepare(`DELETE path FROM files WHERE path LIKE ?`)
      .run(likePattern);

    if (result.changes === 0) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOENT: no such file or directory, unlink '${normalizedDir}'`
      );
      err.code = 'ENOENT';
      throw err;
    }
  };

  const stat = async (filepath: string) => {
    const normalized = normalizePath(filepath);

    const fileRow = await findFile(normalized);

    if (fileRow) {
      const stats: Stats = {
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        mtimeMs: fileRow.mtime,
        mode: fileRow.mode,
      };

      return stats;
    }

    // No file was found. Check for descendants to see if the path corresponds to a directory.
    const likePattern = normalized === '.' ? '%' : `${normalized}/%`;
    const dirExists = db
      .prepare(`SELECT path FROM files WHERE path LIKE ? LIMIT 1`)
      .get(likePattern) as DBFile | undefined;

    if (dirExists) {
      const now = Date.now();

      const stats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        isSymbolicLink: () => false,
        // TODO: This is not accurate but not sure if it's worth calculating in our use case
        mtimeMs: now,
        // standard Unix/Git directory mode
        mode: 0o040755,
      };

      return stats;
    }

    const err: NodeJS.ErrnoException = new Error(
      `ENOENT: no such file or directory, unlink '${normalized}'`
    );
    err.code = 'ENOENT';
    throw err;
  };

  const lstat = async (filepath: string) => {
    // Same as stat since we don't support symlinks in this implementation
    return stat(filepath);
  };

  const chmod = async (filepath: string, mode: Mode) => {
    const normalized = normalizePath(filepath);
    const normalizedMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;

    const result = db
      .prepare(
        `
            UPDATE files SET mode = ?
            WHERE path = ?
          `
      )
      .run(normalizedMode, normalized);

    if (result.changes === 1) {
      // File existed & mode updated
      return;
    }

    // No file was found. Check for descendants to see if the path corresponds to a directory.
    const likePattern = normalized === '.' ? '%' : `${normalized}/%`;
    const dirExists = db
      .prepare(`SELECT path FROM files WHERE path LIKE ? LIMIT 1`)
      .get(likePattern) as DBFile | undefined;

    if (dirExists) {
      // We do nothing in the case of directories.
      // This is OS-specific in real filesystems (Node does nothing on Windows but does something meaningful in POSIX).
      // TODO: Consider a stricter behavior here (e.g. throwing an ENOTSUP error).
      return;
    }

    // Nothing found/updated - throw ENOENT error.
    const err: NodeJS.ErrnoException = new Error(
      `ENOENT: no such file or directory, unlink '${normalized}'`
    );
    err.code = 'ENOENT';
    throw err;
  };

  return {
    readFile,
    writeFile,
    unlink,
    readdir,
    mkdir,
    rmdir,
    stat,
    lstat,
    chmod,
  };
};
