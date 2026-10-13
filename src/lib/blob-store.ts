import { getStore } from '@netlify/blobs';

// ══════════════════════════════════════════════════════════════════════════
// Netlify Blobs with STRONG consistency (Oct 2026).
// ══════════════════════════════════════════════════════════════════════════
// Blobs' default is "eventual" consistency: a read can return the OLD value
// for up to ~60 seconds after a write. That lost Chef's typed Tue–Wed menu
// (Oct 13 2026): he typed + printed, went back to the editor, it loaded an
// older copy of his draft and saved that over his work.
//
// Strong reads always see the latest write. They need the runtime's
// `uncachedEdgeURL`; if a runtime ever lacks it, Blobs throws a consistency
// error — we then fall back to the default store so the app keeps working
// rather than failing every read. Any OTHER error (e.g. no Blobs context in
// local dev) is re-thrown so each store's file-system fallback still kicks in.

let strongAvailable = true;

function isConsistencyError(err: unknown): boolean {
  return /strong consistency|uncachedEdgeURL/i.test(String((err as Error)?.message ?? err));
}

type Store = ReturnType<typeof getStore>;

async function run<T>(name: string, fn: (s: Store) => Promise<T>): Promise<T> {
  if (strongAvailable) {
    try {
      return await fn(getStore(name, { consistency: 'strong' }));
    } catch (err) {
      if (!isConsistencyError(err)) throw err;
      strongAvailable = false;
      console.warn('[blobs] strong consistency unavailable — using default store');
    }
  }
  return fn(getStore(name));
}

/** Drop-in replacement for getStore(name) covering the calls this app uses. */
export function menuBlobStore(name: string) {
  return {
    get: (key: string, _opts: { type: 'text' }): Promise<string | null> =>
      run(name, (s) => s.get(key, { type: 'text' })),
    set: (key: string, value: string): Promise<void> =>
      run(name, async (s) => { await s.set(key, value); }),
    list: (opts: { prefix: string }): Promise<{ blobs: { key: string }[] }> =>
      run(name, (s) => s.list(opts)),
    delete: (key: string): Promise<void> => run(name, (s) => s.delete(key)),
  };
}
