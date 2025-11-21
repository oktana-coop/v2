import {
  type Chunk,
  type StorageAdapterInterface,
  type StorageKey,
} from '@automerge/automerge-repo';
import Database from 'better-sqlite3';

const DEFAULT_TABLE_NAME = 'automerge';
const KEY_PATH_DELIMITER = '/';
const CURRENT_ADAPTER_SCHEMA_VERSION = 1;
import { versionControlSystems } from '../../constants';

const getKey = (key: StorageKey): string => key.join(KEY_PATH_DELIMITER);
const splitKey = (key: string): StorageKey => key.split(KEY_PATH_DELIMITER);

export class SQLite3StorageAdapter implements StorageAdapterInterface {
  private db: Database.Database;
  private tableName: string;

  // Constructor overload signatures
  constructor(path: string, tableName?: string);
  constructor(db: Database.Database, tableName?: string);

  /**
   * @param pathOrDb - The path to the file to store data in, or an already created database.
   * @param tableName - The table name in the SQLite database. Defaults to "automerge-repo-data".
   */
  constructor(
    pathOrDb: string | Database.Database,
    tableName = DEFAULT_TABLE_NAME
  ) {
    if (typeof pathOrDb === 'string') {
      this.db = new Database(pathOrDb);
      this.db.pragma('journal_mode = WAL');
    } else {
      this.db = pathOrDb;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    this.tableName = tableName;

    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS adapter_info (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version_control_system TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        last_migrated_at INTEGER NOT NULL DEFAULT (unixepoch())
      ) STRICT
    `);

    // TODO: Implement migrations when schema changes
    const currentVersion = this.getCurrentSchemaVersion();

    if (currentVersion === 0) {
      // First time setup - create initial schema
      this.createInitialSchema();
      this.setAdapterInfo();
    } else if (currentVersion !== CURRENT_ADAPTER_SCHEMA_VERSION) {
      // Schema version mismatch - let the user handle it
      throw new Error(
        `Database schema version mismatch. Found version ${currentVersion}, expected ${CURRENT_ADAPTER_SCHEMA_VERSION}. ` +
          'Manual migration may be required.'
      );
    }
  }

  private createInitialSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        key TEXT PRIMARY KEY,
        value BLOB
      ) STRICT
    `);
  }

  private getCurrentSchemaVersion(): number {
    try {
      const stmt = this.db.prepare(
        'SELECT schema_version FROM adapter_info ORDER BY schema_version DESC LIMIT 1'
      );
      const result = stmt.get() as { schema_version: number } | undefined;
      return result?.schema_version ?? 0;
    } catch {
      // adapter_info table row doesn't exist yet
      return 0;
    }
  }

  private setAdapterInfo(): void {
    this.db
      .prepare(
        `
          INSERT OR REPLACE INTO adapter_info (id, version_control_system, schema_version)
          VALUES (1, ?, ?)
        `
      )
      .run(versionControlSystems.AUTOMERGE, CURRENT_ADAPTER_SCHEMA_VERSION);
  }

  async load(keyArray: StorageKey): Promise<Uint8Array | undefined> {
    const key = getKey(keyArray);

    const stmt = this.db.prepare(
      `SELECT value FROM ${this.tableName} WHERE key = ?`
    );
    const row = stmt.get(key) as { value: Buffer } | undefined;

    if (!row) {
      return undefined;
    }

    return new Uint8Array(row.value);
  }

  async save(keyArray: StorageKey, binary: Uint8Array): Promise<void> {
    const key = getKey(keyArray);

    const stmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `);

    stmt.run(key, binary);
  }

  async remove(keyArray: StorageKey): Promise<void> {
    const key = getKey(keyArray);

    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE key = ?`);
    stmt.run(key);
  }

  async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
    const prefix = getKey(keyPrefix);

    const stmt = this.db.prepare(
      `SELECT key, value FROM ${this.tableName} WHERE key GLOB ?`
    );
    const rows = stmt.all(`${prefix}*`) as Array<{
      key: string;
      value: Buffer;
    }>;

    return rows.map((row) => {
      return {
        key: splitKey(row.key),
        data: new Uint8Array(row.value),
      };
    });
  }

  async removeRange(keyPrefix: string[]): Promise<void> {
    const prefix = getKey(keyPrefix);

    const stmt = this.db.prepare(
      `DELETE FROM ${this.tableName} WHERE key GLOB ?`
    );
    stmt.run(`${prefix}*`);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get current schema version
   */
  getSchemaVersion(): number {
    return this.getCurrentSchemaVersion();
  }
}
