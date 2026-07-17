import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStore } from '@netlify/blobs';
import { DrinksDessertMenuSchema, type DrinksDessertMenuData } from './drinksdessert-schema';
import { createDraftPublish } from './draft-publish';

const DATA_PATH    = join(process.cwd(), 'drinksdessert-menu-data.json');
const BLOB_STORE   = 'menu-editor';
const BLOB_CURRENT = 'drinksdessert-menu-data';

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

export async function readDrinksDessertMenu(): Promise<DrinksDessertMenuData> {
  const raw = await blobsRead(BLOB_CURRENT);
  if (raw !== BLOBS_UNAVAILABLE && raw) {
    return DrinksDessertMenuSchema.parse(JSON.parse(raw));
  }
  return DrinksDessertMenuSchema.parse(JSON.parse(await readFile(DATA_PATH, 'utf8')));
}

// Seed helper (used to push initial data to production). Not used by the UI.
export async function writeDrinksDessertMenu(data: DrinksDessertMenuData): Promise<void> {
  DrinksDessertMenuSchema.parse(data);
  const json = JSON.stringify(data, null, 2);
  const res = await blobsWrite(BLOB_CURRENT, json);
  if (res === BLOBS_UNAVAILABLE) {
    await writeFile(DATA_PATH, json, 'utf8');
  }
}

// ── Draft / Publish (shared factory) ──────────────────────────────────────

export const drinksdessertDP = createDraftPublish<DrinksDessertMenuData>({
  currentKey:      'drinksdessert-menu-data',
  draftKey:        'drinksdessert-menu-draft',
  metaKey:         'drinksdessert-menu-meta',
  publishedPrefix: 'drinksdessert-published-',
  schema:          DrinksDessertMenuSchema,
  readCurrent:     readDrinksDessertMenu,
});

export const readCurrentMeta = drinksdessertDP.readCurrentMeta;
export const hasDraft        = drinksdessertDP.hasDraft;
export const readDraft       = drinksdessertDP.readDraft;
export const writeDraft      = drinksdessertDP.writeDraft;
export const discardDraft    = drinksdessertDP.discardDraft;
export const publishDraft    = drinksdessertDP.publishDraft;
export const listPublished   = drinksdessertDP.listPublished;
export const readPublished   = drinksdessertDP.readPublished;
export const readMenuBySrc   = drinksdessertDP.readMenuBySrc;
