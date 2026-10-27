import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { createHash } from 'node:crypto';
import { menuBlobStore } from './blob-store';

// ══════════════════════════════════════════════════════════════════════════
// AI spelling + polish check (Oct 2026, Generic menu first).
// ══════════════════════════════════════════════════════════════════════════
// The editor sends a menu's words, each labelled ("Course II dish name"),
// plus the house word list. Claude returns only real problems:
//   misspelled — a wrong spelling ("Barbabieto" → "Barbabietole")
//   style      — understandable but usually written another way
//                ("Sauteed" → "Sautéed", "Mash Potatoes" → "Mashed Potatoes")
// It never changes anything; the editor shows suggestions and Chef chooses.
// Results are cached by content, so an unchanged menu isn't re-checked.

const MODEL = 'claude-opus-5-5';
const PROMPT_VERSION = 'v1';
const STORE = 'menu-editor';
const HOUSE_KEY = 'spell-house-words';
const CACHE_PREFIX = 'spell-cache-';

export interface SpellField { id: string; label: string; text: string }
export interface SpellSuggestion { fieldId: string; original: string; suggestion: string; kind: 'misspelled' | 'style'; why: string }

const ResultSchema = z.object({
  suggestions: z.array(z.object({
    fieldId: z.string(),
    original: z.string(),
    suggestion: z.string(),
    kind: z.enum(['misspelled', 'style']),
    why: z.string(),
  })),
});

const SYSTEM = `You proofread printed menus for Siena Ristorante Toscana, an Italian (Tuscan) restaurant in Austin, Texas. Guests read these menus, so the goal is a polished menu with no mistakes.

Dish names are usually Italian; descriptions are usually English; some text may be Spanish. Treat correct Italian, Spanish, and English as correct — including proper accents and culinary terms (e.g. Pèsca, Cinghiale, Labneh, Casarecce, Pomodoro).

Report two kinds of problems:
- "misspelled": a word that is spelled wrong in its language, or the wrong word for this spot on the menu (for example a section heading for a list of several side dishes should be the plural "Contorni", not "Contorno").
- "style": spelled acceptably but usually written differently on a polished menu — missing accents (Sauteed → Sautéed, Creme Fraiche → Crème Fraîche), "Mash Potatoes" → "Mashed Potatoes", or the same item spelled two different ways in different places.

Rules:
- Only report real problems. Do not rewrite for taste, change capitalization style, reorder words, or comment on prices or layout.
- Never report a word that is on the house word list — the restaurant spells those that way on purpose.
- "original" must be copied exactly as it appears in that field (same letters and accents), and should be the shortest phrase that needs changing. "suggestion" is the replacement for exactly that phrase.
- "why" is one short, plain sentence a non-technical cook would understand.
- If nothing is wrong, return an empty list.`;

function client(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
}

function store() { return menuBlobStore(STORE); }

export async function readHouseWords(): Promise<string[]> {
  try {
    const raw = await store().get(HOUSE_KEY, { type: 'text' });
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((w) => typeof w === 'string') : [];
  } catch { return []; }
}

export async function addHouseWord(word: string): Promise<string[]> {
  const w = word.trim();
  const list = await readHouseWords();
  if (w && !list.some((x) => x.toLowerCase() === w.toLowerCase())) {
    list.push(w);
    list.sort((a, b) => a.localeCompare(b));
    await store().set(HOUSE_KEY, JSON.stringify(list));
  }
  return list;
}

export function spellcheckConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function spellcheck(menuName: string, fields: SpellField[]): Promise<SpellSuggestion[]> {
  const c = client();
  if (!c) throw new Error('not-configured');
  const usable = fields.filter((f) => f.text && f.text.trim());
  if (!usable.length) return [];
  const house = await readHouseWords();

  const payload = JSON.stringify({ menu: menuName, houseWords: house, fields: usable });
  const key = CACHE_PREFIX + createHash('sha256').update(`${MODEL}|${PROMPT_VERSION}|${payload}`).digest('hex').slice(0, 40);
  try {
    const hit = await store().get(key, { type: 'text' });
    if (hit) return JSON.parse(hit) as SpellSuggestion[];
  } catch { /* no cache (local dev) — fine */ }

  const response = await c.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // Opus 5.5 on a refusal falls back automatically (very unlikely for menus).
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Menu: ${menuName}\nHouse word list (spelled this way on purpose): ${house.length ? house.join(', ') : '(none)'}\n\nFields (JSON):\n${JSON.stringify(usable, null, 2)}`,
    }],
    output_config: { effort: 'low', format: zodOutputFormat(ResultSchema) },
  });

  if (response.stop_reason === 'refusal' || !response.parsed_output) return [];
  const byId = new Map(usable.map((f) => [f.id, f.text]));
  const houseLower = new Set(house.map((w) => w.toLowerCase()));
  // Keep only suggestions that point at text that's really there and differ.
  const out = response.parsed_output.suggestions.filter((s) => {
    const text = byId.get(s.fieldId);
    return !!text && s.original && text.includes(s.original) && s.original !== s.suggestion && !houseLower.has(s.original.trim().toLowerCase());
  });
  try { await store().set(key, JSON.stringify(out)); } catch { /* no cache — fine */ }
  return out;
}
