/**
 * Running perek (chapter) headers for Vilna-style page chrome.
 *
 * Chapter names come from Sefaria segment `alts` (whole-chapter markers) and
 * Mishnah-in-Talmud links; names are cached per tractate+perek in KV.
 */

/** Sefaria alt marker on a gemara segment (chapter boundary). */
export interface PerekAlt {
  he?: string[];
  en?: string[];
  whole?: boolean;
}

export interface PerekHeader {
  /** 1-based Mishnah chapter number on this daf. */
  perekNum: number;
  /** Display name (Sefaria convention — often the first words of the perek). */
  nameHe: string;
}

const GEMATRIA_ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const GEMATRIA_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];

/** Hebrew numeral for small perek numbers (1–99). */
export function perekNumberHe(n: number): string {
  if (n <= 0 || n > 99) return String(n);
  if (n === 15) return 'טו';
  if (n === 16) return 'טז';
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${GEMATRIA_TENS[tens] ?? ''}${GEMATRIA_ONES[ones] ?? ''}`;
}

/** Parse `Mishnah Bava Metzia 3:1` → 3. */
export function parsePerekFromMishnaRef(ref: string): number | null {
  const m = /^Mishnah .+? (\d+):\d+/i.exec(ref.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Primary perek on a daf — earliest Mishnah chapter referenced. */
export function primaryPerekFromMishnaRefs(refs: string[]): number | null {
  const nums = refs.map(parsePerekFromMishnaRef).filter((n): n is number => n != null);
  if (nums.length === 0) return null;
  return Math.min(...nums);
}

export function perekNameFromAlt(alt: PerekAlt | null | undefined): string | null {
  if (!alt?.whole) return null;
  const raw = alt.he?.[0]?.trim();
  return raw && raw.length > 0 ? raw : null;
}

/** First whole-chapter alt name on the daf (new perek may start mid-amud). */
export function perekNameOnPage(
  alts: Array<PerekAlt | null | undefined> | undefined,
): string | null {
  if (!alts) return null;
  for (const alt of alts) {
    const name = perekNameFromAlt(alt);
    if (name) return name;
  }
  return null;
}

/** Names discovered on this daf to warm the per-tractate perek-name cache. */
export function perekNamesToCache(
  alts: Array<PerekAlt | null | undefined> | undefined,
  mishnaRefs: string[],
): Array<{ perekNum: number; nameHe: string }> {
  const primary = primaryPerekFromMishnaRefs(mishnaRefs);
  const pageName = perekNameOnPage(alts);
  if (pageName && primary) return [{ perekNum: primary, nameHe: pageName }];
  return [];
}

export function resolveRunningPerekHeader(input: {
  alts?: Array<PerekAlt | null | undefined>;
  mishnaRefs: string[];
  cachedNameByPerek: Record<number, string>;
}): PerekHeader | null {
  const perekNum = primaryPerekFromMishnaRefs(input.mishnaRefs);
  if (!perekNum) return null;

  const onPage = perekNameOnPage(input.alts);
  if (onPage) return { perekNum, nameHe: onPage };

  const cached = input.cachedNameByPerek[perekNum];
  if (cached) return { perekNum, nameHe: cached };

  return { perekNum, nameHe: perekNumberHe(perekNum) };
}

/** Format for the running header line: `פרק …`. */
export function formatPerekHeaderLine(header: PerekHeader): string {
  const name = header.nameHe.trim();
  if (/^[\u0590-\u05FF]+$/.test(name) && name.length <= 2 && /[א-ת]/.test(name)) {
    return `פרק ${name}`;
  }
  if (/^\d+$/.test(name)) {
    return `פרק ${perekNumberHe(parseInt(name, 10))}`;
  }
  return `פרק ${name}`;
}
