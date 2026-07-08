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
// Static import — more reliable than dynamic import in Netlify Functions.
// getStore() itself never throws; only the actual get/set/list calls throw
// when the Netlify runtime context isn't present (i.e. local dev without
// netlify dev CLI). We catch those and fall back to the file system.

import { getStore } from '@netlify/blobs';

function store() {
  return getStore(BLOB_STORE);
}

const BLOBS_UNAVAILABLE = Symbol();

async function blobsRead(key: string): Promise<string | null | typeof BLOBS_UNAVAILABLE> {
  try {
    return await store().get(key, { type: 'text' });
  } catch {
    return BLOBS_UNAVAILABLE;
  }
}

async function blobsWrite(key: string, value: string): Promise<typeof BLOBS_UNAVAILABLE | void> {
  try {
    await store().set(key, value);
  } catch {
    return BLOBS_UNAVAILABLE;
  }
}

async function blobsList(prefix: string): Promise<{ key: string }[]> {
  try {
    const { blobs } = await store().list({ prefix });
    return blobs;
  } catch {
    return [];
  }
}

async function blobsDelete(key: string): Promise<void> {
  try {
    await store().delete(key);
  } catch { /* ignore */ }
}

// ── File-system helpers (local dev) ──────────────────────────────────────

async function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) await mkdir(BACKUP_DIR, { recursive: true });
}

async function pruneFileBackups() {
  const files = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  const backups = files
    .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
    .sort().reverse();
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
  const raw = await blobsRead(BLOB_CURRENT);
  if (raw !== BLOBS_UNAVAILABLE && raw) {
    return MenuSchema.parse(JSON.parse(raw));
  }
  // Local dev fallback
  return MenuSchema.parse(JSON.parse(await readFile(DATA_PATH, 'utf8')));
}

export async function writeMenu(data: MenuData): Promise<void> {
  MenuSchema.parse(data);
  const ts = Date.now();
  const json = JSON.stringify(data, null, 2);

  // Try Netlify Blobs
  const current = await blobsRead(BLOB_CURRENT);
  const writeResult = await blobsWrite(BLOB_CURRENT, json);

  if (writeResult !== BLOBS_UNAVAILABLE) {
    // Blobs worked — archive the previous version
    if (current !== BLOBS_UNAVAILABLE && current) {
      await blobsWrite(`${BLOB_BACKUP_PREFIX}${ts}`, current);
      const all = await blobsList(BLOB_BACKUP_PREFIX);
      const sorted = all
        .map((b) => ({ key: b.key, ts: parseInt(b.key.replace(BLOB_BACKUP_PREFIX, ''), 10) }))
        .sort((a, b) => b.ts - a.ts);
      for (const old of sorted.slice(MAX_BACKUPS)) await blobsDelete(old.key);
    }
    return;
  }

  // Local dev: file system
  await ensureBackupDir();
  if (existsSync(DATA_PATH)) {
    const fileRaw = await readFile(DATA_PATH, 'utf8');
    await writeFile(join(BACKUP_DIR, `backup-${ts}.json`), fileRaw, 'utf8');
    await pruneFileBackups();
  }
  await writeFile(DATA_PATH, json, 'utf8');
}

export async function listBackups(): Promise<BackupEntry[]> {
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

  // Local dev fallback
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
  const raw = await blobsRead(key);
  if (raw !== BLOBS_UNAVAILABLE && raw) {
    const data = MenuSchema.parse(JSON.parse(raw));
    await writeMenu(data);
    return data;
  }
  // Local dev fallback
  const fileRaw = await readFile(join(BACKUP_DIR, key), 'utf8');
  const data = MenuSchema.parse(JSON.parse(fileRaw));
  await writeMenu(data);
  return data;
}

// ══════════════════════════════════════════════════════════════════════════
// Draft / Publish model (Dinner menu)
// ══════════════════════════════════════════════════════════════════════════
// The Dinner menu is PROTECTED: the current published menu (BLOB_CURRENT) only
// changes via an explicit publish. Day-to-day editing happens on a separate
// draft blob, so the current menu can never be altered inadvertently. When a
// draft is published it becomes the new current, the outgoing current is moved
// into a small "past menus" history (last 3), and the current-menu date is
// stamped.

const BLOB_DRAFT            = 'menu-draft';
const BLOB_META            = 'menu-meta';
const BLOB_PUBLISHED_PREFIX = 'published-';
const MAX_PUBLISHED         = 3;
const KV_DIR               = join(process.cwd(), '.menu-kv');

// "Current as of July 9, 2026" — the seed date shown until the first publish,
// used when no meta record exists yet.
const DEFAULT_PUBLISHED_AT = Date.parse('2026-07-09T12:00:00Z');

export interface CurrentMeta { publishedAt: number }
export interface PublishedEntry { key: string; ts: number; publishedAt: number; label: string }

// ── Generic KV (Netlify Blobs in prod, file system in local dev) ──────────

async function kvRead(key: string): Promise<string | null> {
  const r = await blobsRead(key);
  if (r !== BLOBS_UNAVAILABLE) return r;
  const f = join(KV_DIR, key + '.json');
  return existsSync(f) ? await readFile(f, 'utf8') : null;
}

async function kvWrite(key: string, value: string): Promise<void> {
  const r = await blobsWrite(key, value);
  if (r !== BLOBS_UNAVAILABLE) return;
  if (!existsSync(KV_DIR)) await mkdir(KV_DIR, { recursive: true });
  await writeFile(join(KV_DIR, key + '.json'), value, 'utf8');
}

async function kvDelete(key: string): Promise<void> {
  await blobsDelete(key);
  const f = join(KV_DIR, key + '.json');
  if (existsSync(f)) {
    const { unlink } = await import('node:fs/promises');
    await unlink(f).catch(() => {});
  }
}

async function kvList(prefix: string): Promise<string[]> {
  const blobs = await blobsList(prefix);
  if (blobs.length) return blobs.map((b) => b.key);
  if (!existsSync(KV_DIR)) return [];
  const files = await readdir(KV_DIR).catch(() => [] as string[]);
  return files.filter((f) => f.startsWith(prefix) && f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Current-menu metadata (the "current as of" date) ──────────────────────

export async function readCurrentMeta(): Promise<CurrentMeta> {
  const raw = await kvRead(BLOB_META);
  if (raw) {
    try {
      const m = JSON.parse(raw);
      if (typeof m.publishedAt === 'number') return { publishedAt: m.publishedAt };
    } catch { /* fall through to default */ }
  }
  return { publishedAt: DEFAULT_PUBLISHED_AT };
}

// ── Draft ──────────────────────────────────────────────────────────────────

export async function hasDraft(): Promise<boolean> {
  return (await kvRead(BLOB_DRAFT)) !== null;
}

// Returns the draft. If none exists yet, seed it from the current menu and
// persist that copy so subsequent edits accumulate on the draft.
export async function readDraft(): Promise<MenuData> {
  const raw = await kvRead(BLOB_DRAFT);
  if (raw) return MenuSchema.parse(JSON.parse(raw));
  const current = await readMenu();
  await kvWrite(BLOB_DRAFT, JSON.stringify(current, null, 2));
  return current;
}

export async function writeDraft(data: MenuData): Promise<void> {
  MenuSchema.parse(data);
  await kvWrite(BLOB_DRAFT, JSON.stringify(data, null, 2));
}

export async function discardDraft(): Promise<void> {
  await kvDelete(BLOB_DRAFT);
}

// ── Publish (draft → current, archive outgoing current) ───────────────────

export async function publishDraft(): Promise<CurrentMeta> {
  const draftRaw = await kvRead(BLOB_DRAFT);
  if (!draftRaw) throw new Error('No draft to publish');
  const draft = MenuSchema.parse(JSON.parse(draftRaw));

  const ts = Date.now();

  // Archive the outgoing current menu together with the date it had been
  // current since, so "Past Menus" can label each version meaningfully.
  const currentRaw = await kvRead(BLOB_CURRENT);
  if (currentRaw) {
    const meta = await readCurrentMeta();
    const envelope = JSON.stringify({ publishedAt: meta.publishedAt, data: JSON.parse(currentRaw) });
    await kvWrite(`${BLOB_PUBLISHED_PREFIX}${ts}`, envelope);

    // Prune to the last MAX_PUBLISHED archived menus.
    const keys = await kvList(BLOB_PUBLISHED_PREFIX);
    const sorted = keys
      .map((k) => ({ key: k, ts: parseInt(k.replace(BLOB_PUBLISHED_PREFIX, ''), 10) }))
      .sort((a, b) => b.ts - a.ts);
    for (const old of sorted.slice(MAX_PUBLISHED)) await kvDelete(old.key);
  }

  // The draft becomes the new current; stamp the date and clear the draft.
  await kvWrite(BLOB_CURRENT, JSON.stringify(draft, null, 2));
  await kvWrite(BLOB_META, JSON.stringify({ publishedAt: ts }));
  await kvDelete(BLOB_DRAFT);

  return { publishedAt: ts };
}

// ── Past menus (published history) ────────────────────────────────────────

export async function listPublished(): Promise<PublishedEntry[]> {
  const keys = await kvList(BLOB_PUBLISHED_PREFIX);
  const entries: PublishedEntry[] = [];
  for (const key of keys) {
    const ts = parseInt(key.replace(BLOB_PUBLISHED_PREFIX, ''), 10);
    let publishedAt = ts;
    const raw = await kvRead(key);
    if (raw) {
      try {
        const e = JSON.parse(raw);
        if (typeof e.publishedAt === 'number') publishedAt = e.publishedAt;
      } catch { /* keep ts fallback */ }
    }
    entries.push({ key, ts, publishedAt, label: formatDate(publishedAt) });
  }
  return entries.sort((a, b) => b.ts - a.ts).slice(0, MAX_PUBLISHED);
}

export async function readPublished(key: string): Promise<MenuData> {
  const raw = await kvRead(key);
  if (!raw) throw new Error('Published menu not found');
  const parsed = JSON.parse(raw);
  const data = parsed && parsed.data ? parsed.data : parsed; // envelope or bare
  return MenuSchema.parse(data);
}

// ── Source resolver for preview / print routes ────────────────────────────
// src: 'current' (default) | 'draft' | 'published-<ts>'

export async function readMenuBySrc(src: string | null): Promise<MenuData> {
  if (!src || src === 'current') return readMenu();
  if (src === 'draft') return readDraft();
  if (/^published-\d+$/.test(src)) return readPublished(src);
  return readMenu();
}
