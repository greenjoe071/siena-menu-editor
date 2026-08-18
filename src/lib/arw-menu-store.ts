import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStore } from '@netlify/blobs';
import { ArwMenuSchema, type ArwMenuData } from './arw-schema';
import { createDraftPublish } from './draft-publish';

const DATA_PATH    = join(process.cwd(), 'arw-menu-data.json');
const BLOB_STORE   = 'menu-editor';
const BLOB_CURRENT = 'arw-menu-data';

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

export async function readArwMenu(): Promise<ArwMenuData> {
  const raw = await blobsRead(BLOB_CURRENT);
  if (raw !== BLOBS_UNAVAILABLE && raw) {
    return ArwMenuSchema.parse(JSON.parse(raw));
  }
  return ArwMenuSchema.parse(JSON.parse(await readFile(DATA_PATH, 'utf8')));
}

// Seed helper (used to push data to production, and by Fix a Mistake).
export async function writeArwMenu(data: ArwMenuData): Promise<void> {
  ArwMenuSchema.parse(data);
  const json = JSON.stringify(data, null, 2);
  const res = await blobsWrite(BLOB_CURRENT, json);
  if (res === BLOBS_UNAVAILABLE) {
    await writeFile(DATA_PATH, json, 'utf8');
  }
}

// ── Draft / Publish (shared factory) ──────────────────────────────────────

export const arwDP = createDraftPublish<ArwMenuData>({
  currentKey:      'arw-menu-data',
  draftKey:        'arw-menu-draft',
  metaKey:         'arw-menu-meta',
  publishedPrefix: 'arw-published-',
  schema:          ArwMenuSchema,
  readCurrent:     readArwMenu,
});

export const readCurrentMeta = arwDP.readCurrentMeta;
export const hasDraft        = arwDP.hasDraft;
export const readDraft       = arwDP.readDraft;
export const writeDraft      = arwDP.writeDraft;
export const discardDraft    = arwDP.discardDraft;
export const publishDraft    = arwDP.publishDraft;
export const listPublished   = arwDP.listPublished;
export const readPublished   = arwDP.readPublished;
export const readMenuBySrc   = arwDP.readMenuBySrc;
