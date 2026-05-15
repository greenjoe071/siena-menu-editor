import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { WeekendMenuSchema, type WeekendMenuData } from './weekend-schema';
import { getStore } from '@netlify/blobs';

const DATA_PATH   = join(process.cwd(), 'weekend-menu-data.json');
const BACKUP_DIR  = join(process.cwd(), 'weekend-backups');
const MAX_BACKUPS = 10;

const BLOB_STORE         = 'menu-editor';
const BLOB_CURRENT       = 'weekend-menu-data';
const BLOB_BACKUP_PREFIX = 'weekend-backup-';

export interface BackupEntry {
  key:   string;
  ts:    number;
  label: string;
}

// ── Netlify Blobs ─────────────────────────────────────────────────────────

function store() { return getStore(BLOB_STORE); }

const BLOBS_UNAVAILABLE = Symbol();

async function blobsRead(key: string): Promise<string | null | typeof BLOBS_UNAVAILABLE> {
  try { return await store().get(key, { type: 'text' }); }
  catch { return BLOBS_UNAVAILABLE; }
}

async function blobsWrite(key: string, value: string): Promise<typeof BLOBS_UNAVAILABLE | void> {
  try { await store().set(key, value); }
  catch { return BLOBS_UNAVAILABLE; }
}

async function blobsList(prefix: string): Promise<{ key: string }[]> {
  try { const { blobs } = await store().list({ prefix }); return blobs; }
  catch { return []; }
}

async function blobsDelete(key: string): Promise<void> {
  try { await store().delete(key); } catch { /* ignore */ }
}

// ── File-system helpers (local dev) ──────────────────────────────────────

async function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) await mkdir(BACKUP_DIR, { recursive: true });
}

async function pruneFileBackups() {
  const files = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  const backups = files.filter(f => f.startsWith('weekend-backup-') && f.endsWith('.json')).sort().reverse();
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

export async function readWeekendMenu(): Promise<WeekendMenuData> {
  const raw = await blobsRead(BLOB_CURRENT);
  if (raw !== BLOBS_UNAVAILABLE && raw) {
    return WeekendMenuSchema.parse(JSON.parse(raw));
  }
  return WeekendMenuSchema.parse(JSON.parse(await readFile(DATA_PATH, 'utf8')));
}

export async function writeWeekendMenu(data: WeekendMenuData): Promise<void> {
  WeekendMenuSchema.parse(data);
  const ts   = Date.now();
  const json = JSON.stringify(data, null, 2);

  const current     = await blobsRead(BLOB_CURRENT);
  const writeResult = await blobsWrite(BLOB_CURRENT, json);

  if (writeResult !== BLOBS_UNAVAILABLE) {
    if (current !== BLOBS_UNAVAILABLE && current) {
      await blobsWrite(`${BLOB_BACKUP_PREFIX}${ts}`, current);
      const all    = await blobsList(BLOB_BACKUP_PREFIX);
      const sorted = all
        .map(b => ({ key: b.key, ts: parseInt(b.key.replace(BLOB_BACKUP_PREFIX, ''), 10) }))
        .sort((a, b) => b.ts - a.ts);
      for (const old of sorted.slice(MAX_BACKUPS)) await blobsDelete(old.key);
    }
    return;
  }

  // Local dev fallback
  await ensureBackupDir();
  if (existsSync(DATA_PATH)) {
    const fileRaw = await readFile(DATA_PATH, 'utf8');
    await writeFile(join(BACKUP_DIR, `weekend-backup-${ts}.json`), fileRaw, 'utf8');
    await pruneFileBackups();
  }
  await writeFile(DATA_PATH, json, 'utf8');
}

export async function listWeekendBackups(): Promise<BackupEntry[]> {
  const blobs = await blobsList(BLOB_BACKUP_PREFIX);
  if (blobs.length > 0) {
    return blobs
      .map(b => {
        const ts = parseInt(b.key.replace(BLOB_BACKUP_PREFIX, ''), 10);
        return { key: b.key, ts, label: formatLabel(ts) };
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_BACKUPS);
  }

  await ensureBackupDir();
  const files = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  return files
    .filter(f => f.startsWith('weekend-backup-') && f.endsWith('.json'))
    .map(f => {
      const ts = parseInt(f.replace('weekend-backup-', '').replace('.json', ''), 10);
      return { key: f, ts, label: formatLabel(ts) };
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_BACKUPS);
}

export async function restoreWeekendBackup(key: string): Promise<WeekendMenuData> {
  const raw = await blobsRead(key);
  if (raw !== BLOBS_UNAVAILABLE && raw) {
    const data = WeekendMenuSchema.parse(JSON.parse(raw));
    await writeWeekendMenu(data);
    return data;
  }
  const fileRaw = await readFile(join(BACKUP_DIR, key), 'utf8');
  const data    = WeekendMenuSchema.parse(JSON.parse(fileRaw));
  await writeWeekendMenu(data);
  return data;
}
