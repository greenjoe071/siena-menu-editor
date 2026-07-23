import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { readPrivateDiningMenu, writePrivateDiningMenu } from '@/lib/privatedining-menu-store';
import { PrivateDiningMenuSchema, PRIVATEDINING_MENU_IDS, type PrivateDiningMenuId } from '@/lib/privatedining-schema';

export const dynamic = 'force-dynamic';

function isValidMenuId(id: string): id is PrivateDiningMenuId {
  return (PRIVATEDINING_MENU_IDS as readonly string[]).includes(id);
}

// GET current published menu. POST seeds/overwrites current (used for
// initial data seeding — the editor writes drafts, not this).
export async function GET(_request: Request, { params }: { params: { menuId: string } }) {
  if (!isValidMenuId(params.menuId)) {
    return NextResponse.json({ error: 'Unknown private dining menu' }, { status: 404 });
  }
  try {
    return NextResponse.json(await readPrivateDiningMenu(params.menuId));
  } catch {
    return NextResponse.json({ error: 'Failed to read menu' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { menuId: string } }) {
  if (!isValidMenuId(params.menuId)) {
    return NextResponse.json({ error: 'Unknown private dining menu' }, { status: 404 });
  }
  try {
    const body = await request.json();
    const data = PrivateDiningMenuSchema.parse(body);
    await writePrivateDiningMenu(params.menuId, data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
