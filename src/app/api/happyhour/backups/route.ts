import { NextResponse } from 'next/server';
import { listHappyhourBackups, restoreHappyhourBackup } from '@/lib/happyhour-menu-store';

export async function GET() {
  try {
    const backups = await listHappyhourBackups();
    return NextResponse.json(backups);
  } catch {
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { key } = await request.json();
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
    const data = await restoreHappyhourBackup(key);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
