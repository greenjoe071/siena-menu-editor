import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { spellcheck, spellcheckConfigured, type SpellField } from '@/lib/spellcheck';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

// GET → is spelling check set up? POST {menu, fields} → suggestions.
// Any failure answers quickly with an error the editor treats as "skip".
export async function GET() {
  return NextResponse.json({ configured: spellcheckConfigured() });
}

export async function POST(request: Request) {
  if (!spellcheckConfigured()) return NextResponse.json({ error: 'not-configured' }, { status: 503 });
  try {
    const body = await request.json();
    const fields: SpellField[] = Array.isArray(body?.fields)
      ? body.fields
          .filter((f: SpellField) => f && typeof f.id === 'string' && typeof f.text === 'string')
          .slice(0, 200)
          .map((f: SpellField) => ({ id: f.id, label: String(f.label ?? f.id).slice(0, 120), text: f.text.slice(0, 2000) }))
      : [];
    const suggestions = await spellcheck(String(body?.menu ?? 'Menu').slice(0, 80), fields);
    return NextResponse.json({ suggestions });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'busy' }, { status: 429 });
    if (err instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: 'bad-key' }, { status: 502 });
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: 'ai-error' }, { status: 502 });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
