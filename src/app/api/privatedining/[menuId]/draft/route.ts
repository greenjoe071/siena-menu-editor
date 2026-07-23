import { NextResponse } from 'next/server';
import { getMenuDraftPublish } from '@/lib/privatedining-menu-store';
import { makeDraftHandlers } from '@/lib/draft-publish';
import { PRIVATEDINING_MENU_IDS, type PrivateDiningMenuId } from '@/lib/privatedining-schema';

export const dynamic = 'force-dynamic';

function isValidMenuId(id: string): id is PrivateDiningMenuId {
  return (PRIVATEDINING_MENU_IDS as readonly string[]).includes(id);
}

export async function GET(request: Request, ctx: { params: { menuId: string } }) {
  if (!isValidMenuId(ctx.params.menuId)) {
    return NextResponse.json({ error: 'Unknown private dining menu' }, { status: 404 });
  }
  return makeDraftHandlers(getMenuDraftPublish(ctx.params.menuId)).GET();
}

export async function POST(request: Request, ctx: { params: { menuId: string } }) {
  if (!isValidMenuId(ctx.params.menuId)) {
    return NextResponse.json({ error: 'Unknown private dining menu' }, { status: 404 });
  }
  return makeDraftHandlers(getMenuDraftPublish(ctx.params.menuId)).POST(request);
}

export async function DELETE(request: Request, ctx: { params: { menuId: string } }) {
  if (!isValidMenuId(ctx.params.menuId)) {
    return NextResponse.json({ error: 'Unknown private dining menu' }, { status: 404 });
  }
  return makeDraftHandlers(getMenuDraftPublish(ctx.params.menuId)).DELETE();
}
