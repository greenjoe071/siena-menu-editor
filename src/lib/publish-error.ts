// Message for a refused "Make This the Active Menu" (Oct 2026). Drafts now
// save with blank fields (allow-blanks.ts), so the server's full check at
// publish is where a blank required field gets caught — say so plainly.
export async function publishErrorMessage(res: Response): Promise<string> {
  if (res.status !== 422) return 'Publish failed — try again';
  const body = await res.json().catch(() => ({} as { issues?: { path?: (string | number)[] }[] }));
  const issues: { path?: (string | number)[] }[] = body.issues ?? [];
  const where = (p: (string | number)[] = []) =>
    p.map((x) => (typeof x === 'number' ? `#${x + 1}` : String(x).replace(/[_-]/g, ' '))).join(' › ');
  const first = issues[0]?.path?.length ? ` (first one: ${where(issues[0].path)})` : '';
  const n = issues.length || 1;
  return `${n} field${n === 1 ? ' is' : 's are'} still blank or too long${first}. Fix ${n === 1 ? 'it' : 'them'}, then try again — your draft is saved.`;
}
