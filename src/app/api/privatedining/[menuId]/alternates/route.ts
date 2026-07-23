import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { readAlternates, createAlternate } from '@/lib/privatedining-menu-store';
import { PRIVATEDINING_MENU_IDS, type PrivateDiningMenuId } from '@/lib/privatedining-schema';

export const dynamic = 'force-dynamic';

function isValidMenuId(id: string): id is PrivateDiningMenuId {
  return (PRIVATEDINING_MENU_IDS as readonly string[]).includes(id);
}

// GET: list this menu's saved alternates. POST: create a new one.
// Alternates are a separate, always-live-editable library — never gated by
// draft/publish, since editing one never touches the live default menu.
export async function GET(_request: Request, { params }: { params: { menuId: string } }) {
  if (!isValidMenuId(params.menuId)) {
    return NextResponse.json({ error: 'Unknown private dining menu' }, { status: 404 });
  }
  try {
    return NextResponse.json(await readAlternates(params.menuId));
  } catch {
    return NextResponse.json({ error: 'Failed to read alternates' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { menuId: string } }) {
  if (!isValidMenuId(params.menuId)) {
    return NextResponse.json({ error: 'Unknown private dining menu' }, { status: 404 });
  }
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name : '';
    const extraItems = Array.isArray(body?.extraItems) ? body.extraItems : [];
    if (!name.trim()) {
      return NextResponse.json({ error: 'Alternate name is required' }, { status: 422 });
    }
    if (extraItems.length > 2) {
      return NextResponse.json({ error: 'An alternate may carry at most 2 extra items total' }, { status: 422 });
    }
    const alt = await createAlternate(params.menuId, name, extraItems);
    return NextResponse.json(alt);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
