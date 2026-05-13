import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { MenuSchema, type MenuData } from './schema';

// On Netlify (production), NETLIFY env var is set to "true" by the platform.
// Locally (npm run dev), we use the file system.
const IS_NETLIFY = process.env.NETLIFY === 'true';

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

// ── Netlify Blobs helpers ─────────────────────────────────────────────────

async function netlifyStore() {
  const { getStore } = await import('@netlify/blobs');
  return getStore(BLOB_STORE);
}

async function pruneNetlifyBackups(store: Awaited<ReturnType<typeof netlifyStore>>) {
  const { blobs } = await store.list({ prefix: BLOB_BACKUP_PREFIX });
  const sorted = blobs
    .map((b) => ({ key: b.key, ts: parseInt(b.key.replace(BLOB_BACKUP_PREFIX, ''), 10) }))
    .sort((a, b) => b.ts - a.ts);
  for (const old of sorted.slice(MAX_BACKUPS)) {
    await store.delete(old.key);
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
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ── Public API ────────────────────────────────────────────────────────────

export async function readMenu(): Promise<MenuData> {
  if (IS_NETLIFY) {
    const store = await netlifyStore();
    const raw = await store.get(BLOB_CURRENT, { type: 'text' });
    if (raw) return MenuSchema.parse(JSON.parse(raw));
    // First ever deploy — seed from the handoff file in the repo
    const seed = await readFile(join(process.cwd(), 'handoff', 'menu-data.json'), 'utf8');
    return MenuSchema.parse(JSON.parse(seed));
  }
  const raw = await readFile(DATA_PATH, 'utf8');
  return MenuSchema.parse(JSON.parse(raw));
}

export async function writeMenu(data: MenuData): Promise<void> {
  MenuSchema.parse(data);
  const ts = Date.now();

  if (IS_NETLIFY) {
    const store = await netlifyStore();
    const current = await store.get(BLOB_CURRENT, { type: 'text' });
    if (current) {
      await store.set(`${BLOB_BACKUP_PREFIX}${ts}`, current);
      await pruneNetlifyBackups(store);
    }
    await store.set(BLOB_CURRENT, JSON.stringify(data, null, 2));
  } else {
    await ensureBackupDir();
    if (existsSync(DATA_PATH)) {
      const current = await readFile(DATA_PATH, 'utf8');
      await writeFile(join(BACKUP_DIR, `backup-${ts}.json`), current, 'utf8');
      await pruneFileBackups();
    }
    await writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  }
}

export async function listBackups(): Promise<BackupEntry[]> {
  if (IS_NETLIFY) {
    const store = await netlifyStore();
    const { blobs } = await store.list({ prefix: BLOB_BACKUP_PREFIX });
    return blobs
      .map((b) => {
        const ts = parseInt(b.key.replace(BLOB_BACKUP_PREFIX, ''), 10);
        return { key: b.key, ts, label: formatLabel(ts) };
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_BACKUPS);
  }
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
  if (IS_NETLIFY) {
    const store = await netlifyStore();
    const raw = await store.get(key, { type: 'text' });
    if (!raw) throw new Error('Backup not found');
    const data = MenuSchema.parse(JSON.parse(raw));
    await writeMenu(data); // this backs up current before restoring
    return data;
  }
  const raw = await readFile(join(BACKUP_DIR, key), 'utf8');
  const data = MenuSchema.parse(JSON.parse(raw));
  await writeMenu(data);
  return data;
}
