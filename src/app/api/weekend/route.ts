import { NextResponse } from 'next/server';
import { readWeekendMenu, writeWeekendMenu } from '@/lib/weekend-menu-store';
import { WeekendMenuSchema } from '@/lib/weekend-schema';
import { ZodError } from 'zod';

export async function GET() {
  try {
    const data = await readWeekendMenu();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to read weekend menu data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = WeekendMenuSchema.parse(body);
    await writeWeekendMenu(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
