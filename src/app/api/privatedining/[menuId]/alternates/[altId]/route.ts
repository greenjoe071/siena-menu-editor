import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { updateAlternate, deleteAlternate } from '@/lib/privatedining-menu-store';
import { PRIVATEDINING_MENU_IDS, type PrivateDiningMenuId } from '@/lib/privatedining-schema';

export const dynamic = 'force-dynamic';

function isValidMenuId(id: string): id is PrivateDiningMenuId {
  return (PRIVATEDINING_MENU_IDS as readonly string[]).includes(id);
}

export async function PATCH(request: Request, { params }: { params: { menuId: string; altId: string } }) {
  if (!isValidMenuId(params.menuId)) {
    return NextResponse.json({ error: 'Unknown private dining menu' }, { status: 404 });
  }
  try {
    const body = await request.json();
    const patch: { name?: string; extraItems?: unknown } = {};
    if (typeof body?.name === 'string') patch.name = body.name;
    if (Array.isArray(body?.extraItems)) {
      if (body.extraItems.length > 2) {
        return NextResponse.json({ error: 'An alternate may carry at most 2 extra items total' }, { status: 422 });
      }
      patch.extraItems = body.extraItems;
    }
    const alt = await updateAlternate(
      params.menuId,
      params.altId,
      patch as { name?: string; extraItems?: import('@/lib/privatedining-schema').PrivateDiningAlternate['extraItems'] },
    );
    return NextResponse.json(alt);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { menuId: string; altId: string } }) {
  if (!isValidMenuId(params.menuId)) {
    return NextResponse.json({ error: 'Unknown private dining menu' }, { status: 404 });
  }
  try {
    await deleteAlternate(params.menuId, params.altId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
