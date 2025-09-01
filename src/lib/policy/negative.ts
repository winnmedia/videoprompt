export function normalizeNegatives(input: string[]): string[] {
  const blacklist = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const s = raw.trim().toLowerCase();
    if (!s) continue;
    if (blacklist.has(s)) continue;
    blacklist.add(s);
    out.push(s);
  }
  return out;
}
