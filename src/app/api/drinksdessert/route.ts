import { NextResponse } from 'next/server';
import { readDrinksDessertMenu, writeDrinksDessertMenu } from '@/lib/drinksdessert-menu-store';
import { DrinksDessertMenuSchema } from '@/lib/drinksdessert-schema';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

// GET current published menu. POST seeds/overwrites current (used for
// initial data seeding — the editor writes drafts, not this).
export async function GET() {
  try {
    return NextResponse.json(await readDrinksDessertMenu());
  } catch {
    return NextResponse.json({ error: 'Failed to read menu' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = DrinksDessertMenuSchema.parse(body);
    await writeDrinksDessertMenu(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
