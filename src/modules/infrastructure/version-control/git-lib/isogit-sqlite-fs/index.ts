import fs, {
  type Mode,
  type ObjectEncodingOptions,
  type OpenMode,
} from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { type PromiseFsClient as NodeLikeFsApi } from 'isomorphic-git';

import {
  type VersionControlSystem,
  versionControlSystems,
} from '../../constants';

const CURRENT_SCHEMA_VERSION = 1;

type AdapterInfo = {
  versionControlSystem: VersionControlSystem;
  schemaVersion: number;
};

type DBFile = { path: string; content: Buffer; mode: number; mtime: number };

export class SQLite3Fs implements NodeLikeFsApi {
  private db: Database.Database;

  constructor(pathOrDb: string | Database.Database) {
    if (typeof pathOrDb === 'string') {
      this.db = new Database(pathOrDb);
      this.db.pragma('journal_mode = WAL');
    } else {
      this.db = pathOrDb;
    }

    this.initializeSchema();
  }

  private initializeSchema() {
    // Create typed adapter_info table with integer timestamps
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS adapter_info (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        adapter_type TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        last_migrated_at INTEGER NOT NULL DEFAULT (unixepoch())
      ) STRICT
    `);

    const info = this.getAdapterInfo();

    if (!info) {
      // New DB
      this.createInitialSchema();
      this.setAdapterInfo();
      return;
    }

    // Existing DB
    if (info.versionControlSystem !== versionControlSystems.GIT) {
      throw new Error(
        `This SQLite file was created by adapter ${info.versionControlSystem}, not ${versionControlSystems.GIT}.`
      );
    }

    if (info.schemaVersion === CURRENT_SCHEMA_VERSION) {
      return;
    }

    if (info.schemaVersion < CURRENT_SCHEMA_VERSION) {
      this.migrateSchema(info.schemaVersion, CURRENT_SCHEMA_VERSION);
      return;
    }

    throw new Error(
      `Database schema version ${info.schemaVersion} is newer than expected ${CURRENT_SCHEMA_VERSION}. Downgrade not supported.`
    );
  }

  private setAdapterInfo(): void {
    this.db
      .prepare(
        `
            INSERT INTO adapter_info (id, version_control_system, schema_version)
            VALUES (1, ?, ?)
          `
      )
      .run(versionControlSystems.GIT, CURRENT_SCHEMA_VERSION);
  }

  private getAdapterInfo(): AdapterInfo | null {
    const stmt = this.db.prepare(
      'SELECT version_control_system, schema_version FROM adapter_info ORDER BY schema_version DESC LIMIT 1'
    );
    const result = stmt.get() as
      | {
          version_control_system: VersionControlSystem;
          schema_version: number;
        }
      | undefined;

    if (!result) {
      return null;
    }

    return {
      versionControlSystem: result.version_control_system,
      schemaVersion: result.schema_version,
    };
  }

  // TODO: Implement migrations as soon as we need them.
  private migrateSchema(currentVersion: number, targetVersion: number): void {
    console.log(
      `Starting adapter schema migration from v${currentVersion} to v${targetVersion}...`
    );

    this.db
      .prepare(
        `
          UPDATE adapter_info
          SET schema_version = ?, last_migrated_at = unixepoch()
          WHERE id = 1
        `
      )
      .run(targetVersion);
  }

  private createInitialSchema(): void {
    this.db.exec(`
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
  }

  // Normalize paths to POSIX format for cross-platform compatibility
  // Git always uses forward slashes internally, even on Windows
  // This ensures the same .db file works on any OS
  private normalizePath(filepath: string): string {
    const posixPath = filepath.split(path.sep).join(path.posix.sep);
    const normalized = path.posix.normalize(posixPath);

    // Remove leading/trailing slashes for consistency
    const cleaned = normalized.replace(/^\/+|\/+$/g, '');

    // Return '.' for root
    return cleaned === '' ? '.' : cleaned;
  }

  readFile: NodeLikeFsApi['promises']['readFile'] = async (
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
    const normalized = this.normalizePath(filepath);
    const stmt = this.db.prepare('SELECT * FROM files WHERE path = ?');
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

  writeFile: NodeLikeFsApi['promises']['writeFile'] = async (
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
    const normalized = this.normalizePath(filepath);

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

    const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO files (path, content, mode, mtime) 
        VALUES (?, ?, ?, ?)
      `);

    stmt.run(normalized, buffer, mode, mtime);
  };

  unlink: NodeLikeFsApi['promises']['unlink'] = async (filepath: string) => {
    const normalized = this.normalizePath(filepath);

    const stmt = this.db.prepare('DELETE FROM files WHERE path = ?');
    const result = stmt.run(normalized);

    if (result.changes === 0) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOENT: no such file or directory, unlink '${filepath}'`
      );
      err.code = 'ENOENT';
      throw err;
    }
  };

  private async findFile(filepath: string): Promise<DBFile | undefined> {
    return this.db
      .prepare(`SELECT 1 FROM files WHERE path = ?`)
      .get(filepath) as DBFile | undefined;
  }

  readdir: NodeLikeFsApi['promises']['readdir'] = async (dirPath: string) => {
    const normalizedDir = this.normalizePath(dirPath);

    // Check if the path exists but corresponds to a file
    const fileCheck = await this.findFile(normalizedDir);
    if (fileCheck) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOTDIR: not a directory, scandir '${normalizedDir}'`
      );
      err.code = 'ENOTDIR';
      throw err;
    }

    // Get all descendants
    const likePattern = normalizedDir === '.' ? '%' : `${normalizedDir}/%`;
    const rows = this.db
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
  mkdir: NodeLikeFsApi['promises']['mkdir'] = async () => {};

  rmdir: NodeLikeFsApi['promises']['rmdir'] = async (dirPath: string) => {
    const normalizedDir = this.normalizePath(dirPath);

    // Check if the path exists but corresponds to a file
    const fileCheck = await this.findFile(normalizedDir);
    if (fileCheck) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOTDIR: not a directory, scandir '${normalizedDir}'`
      );
      err.code = 'ENOTDIR';
      throw err;
    }

    // Delete all descendants
    const likePattern = normalizedDir === '.' ? '%' : `${normalizedDir}/%`;
    const result = this.db
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
}
