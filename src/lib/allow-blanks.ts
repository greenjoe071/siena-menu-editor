import { z, type ZodTypeAny } from 'zod';

// ══════════════════════════════════════════════════════════════════════════
// "Typing always saves" (Joe's rule, Oct 2026).
// ══════════════════════════════════════════════════════════════════════════
// Returns a copy of a menu schema where required text fields may be BLANK —
// every other rule (max lengths, ids, shapes) stays exactly the same. Used
// for saving drafts and "Make a Change" edits, so a field Chef clears to
// retype never blocks the save. Publishing still uses the full schema, so a
// blank required field can't become the active menu.
//
// Handles the zod pieces our schemas use: object, array, tuple, optional,
// nullable, default, effects (refine), string. Anything else is returned unchanged.

export function allowBlanks<T extends ZodTypeAny>(schema: T): T {
  return loosen(schema) as T;
}

function loosen(s: ZodTypeAny): ZodTypeAny {
  if (s instanceof z.ZodString) {
    const checks = s._def.checks;
    const required = checks.some((c) => c.kind === 'min');
    if (!required) return s;
    const rest = new z.ZodString({ ...s._def, checks: checks.filter((c) => c.kind !== 'min') });
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
