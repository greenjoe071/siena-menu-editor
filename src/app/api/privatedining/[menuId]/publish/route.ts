import { NextResponse } from 'next/server';
import { getMenuDraftPublish } from '@/lib/privatedining-menu-store';
import { makePublishHandler } from '@/lib/draft-publish';
import { PRIVATEDINING_MENU_IDS, type PrivateDiningMenuId } from '@/lib/privatedining-schema';

export const dynamic = 'force-dynamic';

function isValidMenuId(id: string): id is PrivateDiningMenuId {
  return (PRIVATEDINING_MENU_IDS as readonly string[]).includes(id);
}

export async function POST(request: Request, ctx: { params: { menuId: string } }) {
  if (!isValidMenuId(ctx.params.menuId)) {
    return NextResponse.json({ error: 'Unknown private dining menu' }, { status: 404 });
  }
  return makePublishHandler(getMenuDraftPublish(ctx.params.menuId)).POST();
}
