/** Canonical Sefaria-style page ref: `2a`, `14b`, … (daf ≥ 2). */
export const PAGE_REF_RE = /^(\d+)([ab])$/i;

export interface ParsedPageRef {
  daf: number;
  amud: 'a' | 'b';
  /** Lowercase canonical form, e.g. `2a`, `14b`. */
  canonical: string;
}

/**
 * Normalize a page string to lowercase amud. Returns null when the format is
 * not a valid daf-side ref (before 2a, malformed, etc. are left to bounds
 * checks via {@link isValidAmud}).
 */
export function normalizePageRef(page: string): string | null {
  const m = PAGE_REF_RE.exec(page.trim());
  if (!m) return null;
  const daf = parseInt(m[1], 10);
  if (daf < 2) return null;
  const amud = m[2].toLowerCase() as 'a' | 'b';
  return `${daf}${amud}`;
}

export function parsePageRef(page: string): ParsedPageRef | null {
  const canonical = normalizePageRef(page);
  if (!canonical) return null;
  const m = PAGE_REF_RE.exec(canonical)!;
  return {
    daf: parseInt(m[1], 10),
    amud: m[2] as 'a' | 'b',
    canonical,
  };
}
