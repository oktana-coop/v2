import Database from 'better-sqlite3';
import { type PromiseFsClient as IsoGitFsApi } from 'isomorphic-git';

import {
  createAdapter as createNodeLikeFsSQLiteAdapter,
  type NodeLikeFsApi,
} from '../../../../../modules/infrastructure/filesystem/adapters/sqlite-fs/node-like-sqlite-fs';
import {
  type VersionControlSystem,
  versionControlSystems,
} from '../../constants';

const CURRENT_SCHEMA_VERSION = 1;

type AdapterInfo = {
  versionControlSystem: VersionControlSystem;
  schemaVersion: number;
};

export class SQLite3Fs implements IsoGitFsApi {
  private db: Database.Database;
  private nodeLikeFsSQLiteAdapter: NodeLikeFsApi;
  promises: IsoGitFsApi['promises'];

  constructor(pathOrDb: string | Database.Database) {
    if (typeof pathOrDb === 'string') {
      this.db = new Database(pathOrDb);
      this.db.pragma('journal_mode = WAL');
    } else {
      this.db = pathOrDb;
    }

    this.getAdapterInfoAndRunPotentialMigrations();

    // When we setup this low-level adapter, we also create the initial schema with the files table if it doesn't exist.
    // We reuse this adapter's methods in our high-level filesystem API implementation for SQLite,
    // so it lives in the filesystem module and we import it from there.
    this.nodeLikeFsSQLiteAdapter = createNodeLikeFsSQLiteAdapter(this.db);
    this.promises = {
      readFile: this.nodeLikeFsSQLiteAdapter.readFile,
      writeFile: this.nodeLikeFsSQLiteAdapter.writeFile,
      unlink: this.nodeLikeFsSQLiteAdapter.unlink,
      readdir: this.nodeLikeFsSQLiteAdapter.readdir,
      mkdir: this.nodeLikeFsSQLiteAdapter.mkdir,
      rmdir: this.nodeLikeFsSQLiteAdapter.rmdir,
      stat: this.nodeLikeFsSQLiteAdapter.stat,
      lstat: this.nodeLikeFsSQLiteAdapter.lstat,
      chmod: this.nodeLikeFsSQLiteAdapter.chmod,
    };
  }

  private getAdapterInfoAndRunPotentialMigrations() {
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
}
