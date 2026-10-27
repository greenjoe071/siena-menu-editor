import { NextResponse } from 'next/server';
import { readHouseWords, addHouseWord } from '@/lib/spellcheck';

export const dynamic = 'force-dynamic';

// The house word list: words the restaurant spells its own way on purpose
// ("Keep mine" in the editor adds one). Shared by every menu.
export async function GET() {
  return NextResponse.json({ words: await readHouseWords() });
}

export async function POST(request: Request) {
  try {
    const { word } = await request.json();
    if (typeof word !== 'string' || !word.trim() || word.length > 80) {
      return NextResponse.json({ error: 'Invalid word' }, { status: 400 });
    }
    return NextResponse.json({ words: await addHouseWord(word) });
  } catch {
    return NextResponse.json({ error: 'Could not save the word' }, { status: 500 });
  }
}
