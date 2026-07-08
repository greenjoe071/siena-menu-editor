import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getStore } from '@netlify/blobs';

// Minimal schema shape we depend on — any Zod schema satisfies this, and it
// sidesteps ZodObject's stricter input-type variance under a generic <T>.
type Parser<T> = { parse: (data: unknown) => T };

// ══════════════════════════════════════════════════════════════════════════
// Generic "protected current + draft/publish" model, shared by every menu.
// ══════════════════════════════════════════════════════════════════════════
// Each menu keeps a locked "current" published menu that only changes via an
// explicit publish. Editing happens on a separate draft. Publishing promotes
// the draft to current, archives the outgoing current into a small "past
// menus" history (last 3), and stamps the current-as-of date.
//
// All menus share the single Netlify Blobs store `menu-editor`; keys are
// namespaced per menu (e.g. weekend-menu-draft, weekend-published-<ts>).

const BLOB_STORE = 'menu-editor';
const KV_DIR     = join(process.cwd(), '.menu-kv');
const MAX_PUBLISHED = 3;

// "Current as of July 9, 2026" — seed date shown until the first publish.
export const DEFAULT_PUBLISHED_AT = Date.parse('2026-07-09T12:00:00Z');

const BLOBS_UNAVAILABLE = Symbol();

function store() { return getStore(BLOB_STORE); }

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

// ── Generic KV: Netlify Blobs in prod, file system in local dev ───────────

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

// ── Types ─────────────────────────────────────────────────────────────────

export interface CurrentMeta { publishedAt: number }
export interface PublishedEntry { key: string; ts: number; publishedAt: number; label: string }

export interface DraftPublishConfig<T> {
  currentKey:      string;   // e.g. 'weekend-menu-data'
  draftKey:        string;   // e.g. 'weekend-menu-draft'
  metaKey:         string;   // e.g. 'weekend-menu-meta'
  publishedPrefix: string;   // e.g. 'weekend-published-'
  schema:          Parser<T>;
  readCurrent:     () => Promise<T>;   // existing readXMenu()
  defaultPublishedAt?: number;
}

export interface DraftPublish<T> {
  readCurrentMeta: () => Promise<CurrentMeta>;
  hasDraft:        () => Promise<boolean>;
  readDraft:       () => Promise<T>;
  writeDraft:      (data: T) => Promise<void>;
  discardDraft:    () => Promise<void>;
  publishDraft:    () => Promise<CurrentMeta>;
  listPublished:   () => Promise<PublishedEntry[]>;
  readPublished:   (key: string) => Promise<T>;
  readMenuBySrc:   (src: string | null) => Promise<T>;
}

// ── Factory ───────────────────────────────────────────────────────────────

export function createDraftPublish<T>(cfg: DraftPublishConfig<T>): DraftPublish<T> {
  const { currentKey, draftKey, metaKey, publishedPrefix, schema, readCurrent } = cfg;
  const defaultPublishedAt = cfg.defaultPublishedAt ?? DEFAULT_PUBLISHED_AT;

  async function readCurrentMeta(): Promise<CurrentMeta> {
    const raw = await kvRead(metaKey);
    if (raw) {
      try {
        const m = JSON.parse(raw);
        if (typeof m.publishedAt === 'number') return { publishedAt: m.publishedAt };
      } catch { /* fall through */ }
    }
    return { publishedAt: defaultPublishedAt };
  }

  async function hasDraft(): Promise<boolean> {
    return (await kvRead(draftKey)) !== null;
  }

  async function readDraft(): Promise<T> {
    const raw = await kvRead(draftKey);
    if (raw) return schema.parse(JSON.parse(raw));
    const current = await readCurrent();
    await kvWrite(draftKey, JSON.stringify(current, null, 2));
    return current;
  }

  async function writeDraft(data: T): Promise<void> {
    schema.parse(data);
    await kvWrite(draftKey, JSON.stringify(data, null, 2));
  }

  async function discardDraft(): Promise<void> {
    await kvDelete(draftKey);
  }

  async function publishDraft(): Promise<CurrentMeta> {
    const draftRaw = await kvRead(draftKey);
    if (!draftRaw) throw new Error('No draft to publish');
    const draft = schema.parse(JSON.parse(draftRaw));

    const ts = Date.now();

    // Archive the outgoing current with the date it had been current since.
    const currentRaw = await kvRead(currentKey);
    if (currentRaw) {
      const meta = await readCurrentMeta();
      const envelope = JSON.stringify({ publishedAt: meta.publishedAt, data: JSON.parse(currentRaw) });
      await kvWrite(`${publishedPrefix}${ts}`, envelope);

      const keys = await kvList(publishedPrefix);
      const sorted = keys
        .map((k) => ({ key: k, ts: parseInt(k.replace(publishedPrefix, ''), 10) }))
        .sort((a, b) => b.ts - a.ts);
      for (const old of sorted.slice(MAX_PUBLISHED)) await kvDelete(old.key);
    }

    // Draft becomes the new current; stamp date; clear draft.
    await kvWrite(currentKey, JSON.stringify(draft, null, 2));
    await kvWrite(metaKey, JSON.stringify({ publishedAt: ts }));
    await kvDelete(draftKey);

    return { publishedAt: ts };
  }

  async function listPublished(): Promise<PublishedEntry[]> {
    const keys = await kvList(publishedPrefix);
    const entries: PublishedEntry[] = [];
    for (const key of keys) {
      const ts = parseInt(key.replace(publishedPrefix, ''), 10);
      let publishedAt = ts;
      const raw = await kvRead(key);
      if (raw) {
        try {
          const e = JSON.parse(raw);
          if (typeof e.publishedAt === 'number') publishedAt = e.publishedAt;
        } catch { /* keep ts */ }
      }
      entries.push({ key, ts, publishedAt, label: formatDate(publishedAt) });
    }
    return entries.sort((a, b) => b.ts - a.ts).slice(0, MAX_PUBLISHED);
  }

  async function readPublished(key: string): Promise<T> {
    const raw = await kvRead(key);
    if (!raw) throw new Error('Published menu not found');
    const parsed = JSON.parse(raw);
    const data = parsed && parsed.data ? parsed.data : parsed; // envelope or bare
    return schema.parse(data);
  }

  async function readMenuBySrc(src: string | null): Promise<T> {
    if (!src || src === 'current') return readCurrent();
    if (src === 'draft') return readDraft();
    if (src.startsWith(publishedPrefix) && /^\d+$/.test(src.slice(publishedPrefix.length))) {
      return readPublished(src);
    }
    return readCurrent();
  }

  return {
    readCurrentMeta, hasDraft, readDraft, writeDraft, discardDraft,
    publishDraft, listPublished, readPublished, readMenuBySrc,
  };
}

// ── Route-handler factories (keep per-menu API routes to two lines each) ───

export function makeDraftHandlers<T>(dp: DraftPublish<T>) {
  return {
    async GET() {
      try {
        return NextResponse.json(await dp.readDraft());
      } catch {
        return NextResponse.json({ error: 'Failed to read draft' }, { status: 500 });
      }
    },
    async POST(request: Request) {
      try {
        const body = await request.json();
        await dp.writeDraft(body as T);
        return NextResponse.json({ ok: true });
      } catch (err) {
        if (err instanceof ZodError) {
          return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 422 });
        }
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    },
    async DELETE() {
      try {
        await dp.discardDraft();
        return NextResponse.json({ ok: true });
      } catch {
        return NextResponse.json({ error: 'Failed to discard draft' }, { status: 500 });
      }
    },
  };
}

export function makePublishHandler<T>(dp: DraftPublish<T>) {
  return {
    async POST() {
      try {
        const meta = await dp.publishDraft();
        return NextResponse.json({ ok: true, publishedAt: meta.publishedAt });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Publish failed';
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    },
  };
}
