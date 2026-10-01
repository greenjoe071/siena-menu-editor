import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStore } from '@netlify/blobs';
import { CourseMenuSchema, type CourseMenuData } from './coursemenu-schema';
import { createDraftPublish } from './draft-publish';

const DATA_PATH    = join(process.cwd(), 'coursemenu-menu-data.json');
const BLOB_STORE   = 'menu-editor';
const BLOB_CURRENT = 'coursemenu-menu-data';

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

// ── Current menu ──────────────────────────────────────────────────────────

export async function readCourseMenu(): Promise<CourseMenuData> {
  const raw = await blobsRead(BLOB_CURRENT);
  if (raw !== BLOBS_UNAVAILABLE && raw) {
    return CourseMenuSchema.parse(JSON.parse(raw));
  }
  return CourseMenuSchema.parse(JSON.parse(await readFile(DATA_PATH, 'utf8')));
}

// Writes the live menu directly — used by "Fix a Mistake" (/api/coursemenu/fix)
// and to seed production. Doesn't touch the "Current as of" date or Past Menus.
export async function writeCourseMenu(data: CourseMenuData): Promise<void> {
  CourseMenuSchema.parse(data);
  const json = JSON.stringify(data, null, 2);
  const res = await blobsWrite(BLOB_CURRENT, json);
  if (res === BLOBS_UNAVAILABLE) {
    await writeFile(DATA_PATH, json, 'utf8');
  }
}

// ── Draft / Publish (shared factory) ──────────────────────────────────────

export const coursemenuDP = createDraftPublish<CourseMenuData>({
  currentKey:         'coursemenu-menu-data',
  draftKey:           'coursemenu-menu-draft',
  metaKey:            'coursemenu-menu-meta',
  publishedPrefix:    'coursemenu-published-',
  schema:             CourseMenuSchema,
  readCurrent:        readCourseMenu,
  defaultPublishedAt: Date.parse('2026-09-30T17:00:00Z'),
});

export const readCurrentMeta = coursemenuDP.readCurrentMeta;
export const hasDraft        = coursemenuDP.hasDraft;
export const listPublished   = coursemenuDP.listPublished;
export const readMenuBySrc   = coursemenuDP.readMenuBySrc;
