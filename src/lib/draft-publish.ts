import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { menuBlobStore } from './blob-store';

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
const MAX_DRAFT_SNAPSHOTS = 30;
const SNAPSHOT_EVERY_MS = 60_000;

// "Current as of July 9, 2026" — seed date shown until the first publish.
export const DEFAULT_PUBLISHED_AT = Date.parse('2026-07-09T12:00:00Z');

const BLOBS_UNAVAILABLE = Symbol();

function store() { return menuBlobStore(BLOB_STORE); }

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

// Restaurant timezone — Austin, TX. MUST be explicit: this code runs in a
// Netlify server function, which defaults to UTC, not Austin's local time.
// Without an explicit timeZone, a menu published in the evening Central time
// (already "tomorrow" in UTC) gets stamped with the wrong date. Every date
// shown to Joe (the "Current as of" badge and Past Menus labels) must go
// through this function — never call toLocaleDateString() directly.
const RESTAURANT_TZ = 'America/Chicago';

export function formatMenuDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: RESTAURANT_TZ });
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface CurrentMeta { publishedAt: number }
export interface PublishedEntry { key: string; ts: number; publishedAt: number; label: string; note?: string }

export interface DraftPublishConfig<T> {
  currentKey:      string;   // e.g. 'weekend-menu-data'
  draftKey:        string;   // e.g. 'weekend-menu-draft'
  metaKey:         string;   // e.g. 'weekend-menu-meta'
  publishedPrefix: string;   // e.g. 'weekend-published-'
  schema:          Parser<T>;
  readCurrent:     () => Promise<T>;   // existing readXMenu()
  // Looser schema for the work-in-progress draft (blank fields allowed) so a
  // half-typed menu always saves. Publishing still parses with `schema`.
  draftSchema?:    Parser<T>;
  defaultPublishedAt?: number;
  // The current menu is only a designer sample until the first publish
  // (Generic Menu). That first publish replaces it WITHOUT archiving it to
  // Past Menus.
  sampleUntilPublished?: boolean;
}

export interface DraftPublish<T> {
  readCurrentMeta: () => Promise<CurrentMeta>;
  hasPublished:    () => Promise<boolean>;   // false until the first publish stamps meta
  hasDraft:        () => Promise<boolean>;
  readDraft:       () => Promise<T>;
  writeDraft:      (data: T) => Promise<void>;
  discardDraft:    () => Promise<void>;
  publishDraft:    () => Promise<CurrentMeta>;
  listPublished:   () => Promise<PublishedEntry[]>;
  readPublished:   (key: string) => Promise<T>;
  readMenuBySrc:   (src: string | null) => Promise<T>;
  updateNote:      (key: string, note: string) => Promise<void>;
  listDraftSnapshots: () => Promise<{ key: string; ts: number; label: string }[]>;
  readDraftSnapshot:  (key: string) => Promise<unknown>;
}

// ── Factory ───────────────────────────────────────────────────────────────

export function createDraftPublish<T>(cfg: DraftPublishConfig<T>): DraftPublish<T> {
  const { currentKey, draftKey, metaKey, publishedPrefix, schema, readCurrent } = cfg;
  const draftSchema = cfg.draftSchema ?? schema;
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

  async function hasPublished(): Promise<boolean> {
    return (await kvRead(metaKey)) !== null;
  }

  async function hasDraft(): Promise<boolean> {
    return (await kvRead(draftKey)) !== null;
  }

  async function readDraft(): Promise<T> {
    const raw = await kvRead(draftKey);
    if (raw) return draftSchema.parse(JSON.parse(raw));
    const current = await readCurrent();
    await kvWrite(draftKey, JSON.stringify(current, null, 2));
    return current;
  }

  // Draft history (Oct 2026, after Chef's typed Tue–Wed menu was lost): every
  // save also lands in a per-minute snapshot, the last 30 kept, and a draft
  // is snapshotted before it's thrown away. Nothing typed is unrecoverable.
  // Read them back via GET /api/{menu}/draft?history (see makeDraftHandlers).
  const snapPrefix = `${draftKey}-snap-`;

  async function snapshotDraft(json: string): Promise<void> {
    try {
      const bucket = Math.floor(Date.now() / SNAPSHOT_EVERY_MS) * SNAPSHOT_EVERY_MS;
      await kvWrite(`${snapPrefix}${bucket}`, json);
      const keys = await kvList(snapPrefix);
      const sorted = keys
        .map((k) => ({ key: k, ts: parseInt(k.slice(snapPrefix.length), 10) }))
        .sort((a, b) => b.ts - a.ts);
      for (const old of sorted.slice(MAX_DRAFT_SNAPSHOTS)) await kvDelete(old.key);
    } catch { /* a snapshot problem must never block the real save */ }
  }

  async function writeDraft(data: T): Promise<void> {
    draftSchema.parse(data);
    const json = JSON.stringify(data, null, 2);
    await kvWrite(draftKey, json);
    await snapshotDraft(json);
  }

  async function discardDraft(): Promise<void> {
    const raw = await kvRead(draftKey);
    if (raw) await snapshotDraft(raw);
    await kvDelete(draftKey);
  }

  async function listDraftSnapshots(): Promise<{ key: string; ts: number; label: string }[]> {
    const keys = await kvList(snapPrefix);
    return keys
      .map((k) => {
        const ts = parseInt(k.slice(snapPrefix.length), 10);
        return { key: k, ts, label: new Date(ts).toLocaleString('en-US', { timeZone: RESTAURANT_TZ }) };
      })
      .sort((a, b) => b.ts - a.ts);
  }

  async function readDraftSnapshot(key: string): Promise<unknown> {
    if (!key.startsWith(snapPrefix)) throw new Error('Not a draft snapshot');
    const raw = await kvRead(key);
    if (!raw) throw new Error('Snapshot not found');
    return JSON.parse(raw);
  }

  async function publishDraft(): Promise<CurrentMeta> {
    const draftRaw = await kvRead(draftKey);
    if (!draftRaw) throw new Error('No draft to publish');
    const draft = schema.parse(JSON.parse(draftRaw));

    const ts = Date.now();

    // Archive the outgoing current with the date it had been current since.
    const currentRaw = await kvRead(currentKey);
    const currentIsSample = cfg.sampleUntilPublished && !(await hasPublished());
    if (currentRaw && !currentIsSample) {
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
      let note: string | undefined;
      const raw = await kvRead(key);
      if (raw) {
        try {
          const e = JSON.parse(raw);
          if (typeof e.publishedAt === 'number') publishedAt = e.publishedAt;
          if (typeof e.note === 'string' && e.note) note = e.note;
        } catch { /* keep ts */ }
      }
      entries.push({ key, ts, publishedAt, label: formatMenuDate(publishedAt), note });
    }
    return entries.sort((a, b) => b.ts - a.ts).slice(0, MAX_PUBLISHED);
  }

  // A short, optional description Joe can attach to a past menu (e.g. "Summer
  // version — lighter pastas") so it's easy to tell entries apart at a glance.
  // Stored inside the same envelope as the archived menu data.
  async function updateNote(key: string, note: string): Promise<void> {
    const raw = await kvRead(key);
    if (!raw) throw new Error('Published menu not found');
    const envelope = JSON.parse(raw);
    envelope.note = note;
    await kvWrite(key, JSON.stringify(envelope));
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
    readCurrentMeta, hasPublished, hasDraft, readDraft, writeDraft, discardDraft,
    publishDraft, listPublished, readPublished, readMenuBySrc, updateNote,
    listDraftSnapshots, readDraftSnapshot,
  };
}

// ── Route-handler factories (keep per-menu API routes to two lines each) ───

export function makeDraftHandlers<T>(dp: DraftPublish<T>) {
  return {
    // ?history → list of draft snapshots; ?snapshot=<key> → one snapshot.
    // Read-only recovery tools; plain GET still opens the draft as before.
    async GET(request: Request) {
      try {
        const params = new URL(request.url).searchParams;
        if (params.has('history')) return NextResponse.json(await dp.listDraftSnapshots());
        const snap = params.get('snapshot');
        if (snap) return NextResponse.json(await dp.readDraftSnapshot(snap));
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
        if (err instanceof ZodError) {
          return NextResponse.json({ error: 'Draft is incomplete', issues: err.issues }, { status: 422 });
        }
        const msg = err instanceof Error ? err.message : 'Publish failed';
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    },
  };
}

// "Fix a Mistake" — reads and writes the CURRENT menu directly. No draft, no
// publish step, no history archive (a quick typo/price correction shouldn't
// burn one of the 3 "Past Menus" slots). `writeCurrent` is each menu's
// existing write{Name}Menu() — already validates via schema.parse and keeps
// its own hidden legacy per-save backup, which is a fine safety net here.
export function makeFixHandlers<T>(readCurrent: () => Promise<T>, writeCurrent: (data: T) => Promise<void>) {
  return {
    async GET() {
      try {
        return NextResponse.json(await readCurrent());
      } catch {
        return NextResponse.json({ error: 'Failed to read active menu' }, { status: 500 });
      }
    },
    async POST(request: Request) {
      try {
        const body = await request.json();
        await writeCurrent(body as T);
        return NextResponse.json({ ok: true });
      } catch (err) {
        if (err instanceof ZodError) {
          return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 422 });
        }
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    },
  };
}

export function makeNoteHandler<T>(dp: DraftPublish<T>) {
  return {
    async POST(request: Request) {
      try {
        const { key, note } = await request.json();
        if (typeof key !== 'string' || typeof note !== 'string') {
          return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }
        await dp.updateNote(key, note);
        return NextResponse.json({ ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save note';
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    },
  };
}
