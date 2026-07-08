import { NextResponse } from 'next/server';
import { publishDraft } from '@/lib/menu-store';

export const dynamic = 'force-dynamic';

// POST — publish the current draft as the new current menu. Archives the
// outgoing current into "Past Menus" and stamps the new current-as-of date.
export async function POST() {
  try {
    const meta = await publishDraft();
    return NextResponse.json({ ok: true, publishedAt: meta.publishedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Publish failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
