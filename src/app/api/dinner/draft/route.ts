import { NextResponse } from 'next/server';
import { readDraft, writeDraft, discardDraft } from '@/lib/menu-store';
import { MenuSchema } from '@/lib/schema';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

// GET — returns the working draft. If none exists yet, it is seeded from the
// current menu (and persisted) so the editor always has something to edit.
export async function GET() {
  try {
    const data = await readDraft();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to read draft' }, { status: 500 });
  }
}

// POST — autosave the draft. Never touches the current published menu.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = MenuSchema.parse(body);
    await writeDraft(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — discard the draft (e.g. "start over from current").
export async function DELETE() {
  try {
    await discardDraft();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to discard draft' }, { status: 500 });
  }
}
