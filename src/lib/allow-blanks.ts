import { z, type ZodTypeAny } from 'zod';

// ══════════════════════════════════════════════════════════════════════════
// "Typing always saves" (Joe's rule, Oct 2026).
// ══════════════════════════════════════════════════════════════════════════
// Returns a copy of a menu schema where required text fields may be BLANK
// and text may run past its letter limit — ids, shapes and patterns stay
// the same. Used for saving drafts and "Make a Change" edits, so a field
// Chef clears to retype, or a name that's a few letters too long, never
// blocks the save. Publishing still uses the full schema, so a blank or
// too-long field can't become the active menu.
//
// Oct 27 2026: letter limits added here. Weekend refused to save a 30-letter
// dish name (limit 26) on Oct 22; the stuck copy later came back over newer
// fixes. A generous ceiling (SAVE_MAX) stays as paste protection.
//
// Handles the zod pieces our schemas use: object, array, tuple, optional,
// nullable, default, effects (refine), string. Anything else is returned unchanged.

const SAVE_MAX = 2000;

export function allowBlanks<T extends ZodTypeAny>(schema: T): T {
  return loosen(schema) as T;
}

function loosen(s: ZodTypeAny): ZodTypeAny {
  if (s instanceof z.ZodString) {
    const checks = s._def.checks;
    const required = checks.some((c) => c.kind === 'min');
    const limited = checks.some((c) => c.kind === 'max' && c.value < SAVE_MAX);
    if (!required && !limited) return s;
    const rest = new z.ZodString({
      ...s._def,
      checks: checks
        .filter((c) => c.kind !== 'min')
        .map((c) => (c.kind === 'max' ? { ...c, value: Math.max(c.value, SAVE_MAX) } : c)),
    });
    // A pattern (e.g. "digits only") would still reject a blank — allow '' explicitly.
    return checks.some((c) => c.kind === 'regex') ? z.union([z.literal(''), rest]) : rest;
  }
  if (s instanceof z.ZodObject) {
    const shape = s.shape as Record<string, ZodTypeAny>;
    const next: Record<string, ZodTypeAny> = {};
    for (const k of Object.keys(shape)) next[k] = loosen(shape[k]);
    return new z.ZodObject({ ...s._def, shape: () => next });
  }
  if (s instanceof z.ZodArray) return new z.ZodArray({ ...s._def, type: loosen(s._def.type) });
  if (s instanceof z.ZodTuple) {
    return new z.ZodTuple({ ...s._def, items: s._def.items.map(loosen) as [ZodTypeAny, ...ZodTypeAny[]] });
  }
  if (s instanceof z.ZodOptional) return new z.ZodOptional({ ...s._def, innerType: loosen(s._def.innerType) });
  if (s instanceof z.ZodNullable) return new z.ZodNullable({ ...s._def, innerType: loosen(s._def.innerType) });
  if (s instanceof z.ZodDefault)  return new z.ZodDefault({ ...s._def, innerType: loosen(s._def.innerType) });
  // .refine / .superRefine / .transform — keep the extra check, loosen what it wraps.
  if (s instanceof z.ZodEffects)  return new z.ZodEffects({ ...s._def, schema: loosen(s._def.schema) });
  return s;
}
