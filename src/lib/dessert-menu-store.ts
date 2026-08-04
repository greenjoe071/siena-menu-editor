import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStore } from '@netlify/blobs';
import { DessertMenuSchema, type DessertMenuData } from './dessert-schema';
import { createDraftPublish } from './draft-publish';

const DATA_PATH    = join(process.cwd(), 'dessert-menu-data.json');
const BLOB_STORE   = 'menu-editor';
const BLOB_CURRENT = 'dessert-menu-data';

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

// ── Current menu (protected — only publish writes it) ─────────────────────

export async function readDessertMenu(): Promise<DessertMenuData> {
  const raw = await blobsRead(BLOB_CURRENT);
  if (raw !== BLOBS_UNAVAILABLE && raw) {
    return DessertMenuSchema.parse(JSON.parse(raw));
  }
  return DessertMenuSchema.parse(JSON.parse(await readFile(DATA_PATH, 'utf8')));
}

// Seed helper (used to push initial data to production). Not used by the UI.
export async function writeDessertMenu(data: DessertMenuData): Promise<void> {
  DessertMenuSchema.parse(data);
  const json = JSON.stringify(data, null, 2);
  const res = await blobsWrite(BLOB_CURRENT, json);
  if (res === BLOBS_UNAVAILABLE) {
    await writeFile(DATA_PATH, json, 'utf8');
  }
}

// ── Draft / Publish (shared factory) ──────────────────────────────────────

export const dessertDP = createDraftPublish<DessertMenuData>({
  currentKey:      'dessert-menu-data',
  draftKey:        'dessert-menu-draft',
  metaKey:         'dessert-menu-meta',
  publishedPrefix: 'dessert-published-',
  schema:          DessertMenuSchema,
  readCurrent:     readDessertMenu,
});

export const readCurrentMeta = dessertDP.readCurrentMeta;
export const hasDraft        = dessertDP.hasDraft;
export const readDraft       = dessertDP.readDraft;
export const writeDraft      = dessertDP.writeDraft;
export const discardDraft    = dessertDP.discardDraft;
export const publishDraft    = dessertDP.publishDraft;
export const listPublished   = dessertDP.listPublished;
export const readPublished   = dessertDP.readPublished;
export const readMenuBySrc   = dessertDP.readMenuBySrc;
