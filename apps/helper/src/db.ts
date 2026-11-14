/**
 * Persistence for the invite-code -> room-address mapping.
 *
 * Own tiny SQLite file via node:sqlite (built into Node >=22.5) — deliberately
 * NOT bleak-node's SQLite, which bleak-web never touches. Runtime state only;
 * the mapping is disposable per environment.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface InviteRecord {
  code: string;
  roomAddress: string;
  createdAt: string;
}

export class InviteStore {
  private readonly db: DatabaseSync;
  private readonly lookup: ReturnType<DatabaseSync['prepare']>;
  private readonly insert: ReturnType<DatabaseSync['prepare']>;

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(resolve(path)), { recursive: true });
    }
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS invites ('
        + 'code TEXT PRIMARY KEY,'
        + 'room_address TEXT NOT NULL,'
        + 'created_at TEXT NOT NULL'
        + ');'
    );
    this.lookup = this.db.prepare(
      'SELECT code, room_address AS roomAddress, created_at AS createdAt FROM invites WHERE code = ?'
    );
    this.insert = this.db.prepare('INSERT INTO invites (code, room_address, created_at) VALUES (?, ?, ?)');
  }

  /** Resolve a 6-digit code to its room address, or null when unknown. */
  resolve(code: string): InviteRecord | null {
    const row = this.lookup.get(code) as InviteRecord | undefined;
    return row ?? null;
  }

  /** Store a mapping; throws when the code already exists. */
  save(code: string, roomAddress: string): void {
    this.insert.run(code, roomAddress, new Date().toISOString());
  }

  close(): void {
    this.db.close();
  }
}
