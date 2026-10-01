import { NextResponse } from 'next/server';
import { hasPublished } from '@/lib/coursemenu-menu-store';

export const dynamic = 'force-dynamic';

// Lets the editor word its publish confirmation for the very first publish
// (the sample is replaced, not moved to Past Menus).
export async function GET() {
  return NextResponse.json({ published: await hasPublished() });
}
