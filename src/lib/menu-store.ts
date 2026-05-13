import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { MenuSchema, type MenuData } from './schema';

const DATA_PATH = join(process.cwd(), 'menu-data.json');
const BACKUP_DIR = join(process.cwd(), 'backups');
const MAX_BACKUPS = 10;
const BLOB_STORE = 'menu-editor';
const BLOB_CURRENT = 'menu-data';
const BLOB_BACKUP_PREFIX = 'backup-';

export interface BackupEntry {
  key: string;
  ts: number;
  label: string;
}

// ── Netlify Blobs ─────────────────────────────────────────────────────────
// Always try blobs first. On Netlify they work; locally they throw and we
// fall back to the file system. This avoids needing to detect the environment.

async function blobsRead(key: string): Promise<string | null> {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore(BLOB_STORE);
    return await store.get(key, { type: 'text' });
  } catch {
    return undefined as unknown as null; // blobs not available
  }
}

const BLOBS_UNAVAILABLE = Symbol();

async function blobsWrite(key: string, value: string): Promise<typeof BLOBS_UNAVAILABLE | void> {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore(BLOB_STORE);
    await store.set(key, value);
  } catch {
    return BLOBS_UNAVAILABLE;
  }
}

async function blobsList(prefix: string): Promise<{ key: string }[]> {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore(BLOB_STORE);
    const { blobs } = await store.list({ prefix });
    return blobs;
  } catch {
    return [];
  }
}

async function blobsDelete(key: string): Promise<void> {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore(BLOB_STORE);
    await store.delete(key);
  } catch {
    // ignore
  }
}

// ── File-system helpers (local dev) ──────────────────────────────────────

async function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) await mkdir(BACKUP_DIR, { recursive: true });
}

async function pruneFileBackups() {
  const files = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  const backups = files
    .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
    .sort()
    .reverse();
  for (const old of backups.slice(MAX_BACKUPS)) {
    const { unlink } = await import('node:fs/promises');
    await unlink(join(BACKUP_DIR, old)).catch(() => {});
  }
}

// ── Formatting ────────────────────────────────────────────────────────────

function formatLabel(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ── Public API ────────────────────────────────────────────────────────────

export async function readMenu(): Promise<MenuData> {
  // Try Netlify Blobs first
  const raw = await blobsRead(BLOB_CURRENT);
  if (raw) return MenuSchema.parse(JSON.parse(raw));

  // Fall back to file system (local dev, or first deploy before any save)
  const fileRaw = await readFile(DATA_PATH, 'utf8');
  return MenuSchema.parse(JSON.parse(fileRaw));
}

export async function writeMenu(data: MenuData): Promise<void> {
  MenuSchema.parse(data);
  const ts = Date.now();

  // Try Netlify Blobs first
  const current = await blobsRead(BLOB_CURRENT);
  const result = await blobsWrite(BLOB_CURRENT, JSON.stringify(data, null, 2));

  if (result !== BLOBS_UNAVAILABLE) {
    // Blobs worked — save backup too
    if (current) {
      await blobsWrite(`${BLOB_BACKUP_PREFIX}${ts}`, current);
      // Prune old backups
      const all = await blobsList(BLOB_BACKUP_PREFIX);
      const sorted = all
        .map((b) => ({ key: b.key, ts: parseInt(b.key.replace(BLOB_BACKUP_PREFIX, ''), 10) }))
        .sort((a, b) => b.ts - a.ts);
      for (const old of sorted.slice(MAX_BACKUPS)) {
        await blobsDelete(old.key);
      }
    }
    return;
  }

  // File system fallback (local dev)
  await ensureBackupDir();
  if (existsSync(DATA_PATH)) {
    const fileRaw = await readFile(DATA_PATH, 'utf8');
    await writeFile(join(BACKUP_DIR, `backup-${ts}.json`), fileRaw, 'utf8');
    await pruneFileBackups();
  }
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function listBackups(): Promise<BackupEntry[]> {
  // Try Netlify Blobs first
  const blobs = await blobsList(BLOB_BACKUP_PREFIX);
  if (blobs.length > 0) {
    return blobs
      .map((b) => {
        const ts = parseInt(b.key.replace(BLOB_BACKUP_PREFIX, ''), 10);
        return { key: b.key, ts, label: formatLabel(ts) };
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_BACKUPS);
  }

  // File system fallback
  await ensureBackupDir();
  const files = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  return files
    .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
    .map((f) => {
      const ts = parseInt(f.replace('backup-', '').replace('.json', ''), 10);
      return { key: f, ts, label: formatLabel(ts) };
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_BACKUPS);
}

export async function restoreBackup(key: string): Promise<MenuData> {
  // Try Netlify Blobs first
  const raw = await blobsRead(key);
  if (raw) {
    const data = MenuSchema.parse(JSON.parse(raw));
    await writeMenu(data);
    return data;
  }

  // File system fallback
  const fileRaw = await readFile(join(BACKUP_DIR, key), 'utf8');
  const data = MenuSchema.parse(JSON.parse(fileRaw));
  await writeMenu(data);
  return data;
}
