import path from 'node:path';

import {
  type Chunk,
  type StorageAdapterInterface,
  type StorageKey,
} from '@automerge/automerge-repo';
import Database from 'better-sqlite3';

// TODO: Consider versioning to facilitate schema migrations.
const DEFAULT_TABLE_NAME = 'automerge-repo-data';

const getKey = (key: StorageKey): string => path.join(...key);

export class SQLite3StorageAdapter implements StorageAdapterInterface {
  private db: Database.Database;
  private tableName: string;

  /**
   * @param path - The path to the file to store data in.
   * @param tableName - The table name in the SQLite database. Defaults to "automerge-repo-data".
   */
  constructor(path: string, tableName = DEFAULT_TABLE_NAME) {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.tableName = tableName;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        key TEXT PRIMARY KEY,
        value BLOB
      ) STRICT
    `);
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
      ON CONFLICT(key) DO UPDATE SET val=excluded.value
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
      `SELECT key, data FROM ${this.tableName} WHERE key GLOB ?`
    );
    const rows = stmt.all(`${prefix}*`) as Array<{
      key: string;
      value: Buffer;
    }>;

    return rows.map((row) => ({
      key: row.key.split(path.sep),
      data: new Uint8Array(row.value),
    }));
  }

  async removeRange(keyPrefix: string[]): Promise<void> {
    const prefix = getKey(keyPrefix);

    const stmt = this.db.prepare(
      `DELETE FROM ${this.tableName} WHERE key GLOB ?`
    );
    stmt.run(`${prefix}*`);
  }
}
