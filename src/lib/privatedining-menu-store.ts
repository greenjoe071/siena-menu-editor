import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getStore } from '@netlify/blobs';
import {
  PrivateDiningMenuSchema,
  AlternatesListSchema,
  PRIVATEDINING_MENU_IDS,
  type PrivateDiningMenuId,
  type PrivateDiningMenuData,
  type PrivateDiningAlternate,
  type PrivateDiningAlternatesList,
} from './privatedining-schema';
import { createDraftPublish, type DraftPublish } from './draft-publish';

const DATA_PATH  = join(process.cwd(), 'privatedining-menu-data.json');
const BLOB_STORE = 'menu-editor';
const KV_DIR     = join(process.cwd(), '.menu-kv');

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

// Same Netlify Blobs-in-prod / file-system-in-dev pattern as draft-publish.ts's
// internal kvRead/kvWrite (not exported from there, so duplicated here — matches
// how drinksdessert-menu-store.ts keeps its own tiny read/write wrapper too).
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

interface SeedFile {
  menus: Array<{
    id: string;
    label: string;
    internalPriceRef: string;
    courses: PrivateDiningMenuData['courses'];
    alternates: PrivateDiningAlternate[];
  }>;
}

let seedCache: SeedFile | null = null;
async function readSeed(): Promise<SeedFile> {
  if (!seedCache) seedCache = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  return seedCache!;
}

function seedMenu(seed: SeedFile, id: PrivateDiningMenuId) {
  const menu = seed.menus.find((m) => m.id === id);
  if (!menu) throw new Error(`Unknown private dining menu id: ${id}`);
  return menu;
}

// ── Current menu content (protected — only publishDraft writes it) ────────

export async function readPrivateDiningMenu(id: PrivateDiningMenuId): Promise<PrivateDiningMenuData> {
  const raw = await kvRead(currentKey(id));
  if (raw) return PrivateDiningMenuSchema.parse(JSON.parse(raw));
  const seed = seedMenu(await readSeed(), id);
  return PrivateDiningMenuSchema.parse({
    label: seed.label,
    internalPriceRef: seed.internalPriceRef,
    courses: seed.courses,
  });
}

// Seed helper (used to push initial/updated data to production). Not used by the UI.
export async function writePrivateDiningMenu(id: PrivateDiningMenuId, data: PrivateDiningMenuData): Promise<void> {
  PrivateDiningMenuSchema.parse(data);
  await kvWrite(currentKey(id), JSON.stringify(data, null, 2));
}

function currentKey(id: PrivateDiningMenuId)   { return `privatedining-${id}-menu-data`; }
function draftKey(id: PrivateDiningMenuId)      { return `privatedining-${id}-menu-draft`; }
function metaKey(id: PrivateDiningMenuId)       { return `privatedining-${id}-menu-meta`; }
function publishedPrefix(id: PrivateDiningMenuId) { return `privatedining-${id}-published-`; }
function alternatesKey(id: PrivateDiningMenuId) { return `privatedining-${id}-alternates`; }

// ── Draft / Publish (one instance per menu id) ─────────────────────────────

const dpByMenu = {} as Record<PrivateDiningMenuId, DraftPublish<PrivateDiningMenuData>>;
for (const id of PRIVATEDINING_MENU_IDS) {
  dpByMenu[id] = createDraftPublish<PrivateDiningMenuData>({
    currentKey:      currentKey(id),
    draftKey:        draftKey(id),
    metaKey:         metaKey(id),
    publishedPrefix: publishedPrefix(id),
    schema:          PrivateDiningMenuSchema,
    readCurrent:     () => readPrivateDiningMenu(id),
  });
}

export function getMenuDraftPublish(id: PrivateDiningMenuId): DraftPublish<PrivateDiningMenuData> {
  return dpByMenu[id];
}

// ── Alternates: a named, saved library per menu — NOT draft/publish. Editing
//    this list never touches the live default menu above. ────────────────

export async function readAlternates(id: PrivateDiningMenuId): Promise<PrivateDiningAlternatesList> {
  const raw = await kvRead(alternatesKey(id));
  if (raw) return AlternatesListSchema.parse(JSON.parse(raw));
  const seed = seedMenu(await readSeed(), id);
  return AlternatesListSchema.parse(seed.alternates);
}

async function writeAlternates(id: PrivateDiningMenuId, list: PrivateDiningAlternatesList): Promise<void> {
  AlternatesListSchema.parse(list);
  await kvWrite(alternatesKey(id), JSON.stringify(list, null, 2));
}

function newAlternateId(id: PrivateDiningMenuId): string {
  return `alt-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createAlternate(
  id: PrivateDiningMenuId,
  name: string,
  extraItems: PrivateDiningAlternate['extraItems'] = [],
): Promise<PrivateDiningAlternate> {
  const list = await readAlternates(id);
  const alt: PrivateDiningAlternate = { id: newAlternateId(id), name, extraItems };
  await writeAlternates(id, [...list, alt]);
  return alt;
}

export async function updateAlternate(
  id: PrivateDiningMenuId,
  alternateId: string,
  patch: Partial<Pick<PrivateDiningAlternate, 'name' | 'extraItems'>>,
): Promise<PrivateDiningAlternate> {
  const list = await readAlternates(id);
  const idx = list.findIndex((a) => a.id === alternateId);
  if (idx === -1) throw new Error('Alternate not found');
  const updated: PrivateDiningAlternate = { ...list[idx], ...patch };
  const next = [...list];
  next[idx] = updated;
  await writeAlternates(id, next);
  return updated;
}

export async function deleteAlternate(id: PrivateDiningMenuId, alternateId: string): Promise<void> {
  const list = await readAlternates(id);
  await writeAlternates(id, list.filter((a) => a.id !== alternateId));
}
