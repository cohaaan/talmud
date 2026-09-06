import { extractTalmudContent, normalizeHebrew, wordsMatchFuzzy } from '../sefref/alignment';

/** Strip HTML/entities and split into Hebrew/Aramaic word tokens. */
export function extractWords(html: string): string[] {
  if (!html) return [];
  const plain = extractTalmudContent(html);
  return plain
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => !!normalizeHebrew(w));
}

/** First N meaningful words after normalization (for fingerprinting). */
export function firstWords(html: string, count: number): string[] {
  return extractWords(html).slice(0, count);
}

/** Stable fingerprint: normalized first words joined, for equality checks. */
export function openingFingerprint(html: string, wordCount = 6): string {
  return firstWords(html, wordCount)
    .map((w) => normalizeHebrew(w))
    .join('|');
}

/** Do the first `minWords` HB words fuzzy-match the Sefaria segment opener? */
export function mainOpensWithSegments(
  mainHebrew: string,
  segmentsHe: string[],
  minWords = 2,
): boolean {
  if (!mainHebrew || segmentsHe.length === 0) return false;
  const hbWords = extractWords(mainHebrew);
  if (hbWords.length < minWords) return false;

  const segWords = extractWords(segmentsHe[0]);
  if (segWords.length === 0) return false;

  // Sefaria often prefixes מתני׳; HB Vilna text usually omits it — skip when
  // matching so both sources align on the mishna body.
  let sj = 0;
  while (sj < segWords.length && normalizeHebrew(segWords[sj]) === normalizeHebrew('מתני')) {
    sj++;
  }
  if (sj >= segWords.length) sj = 0;

  const needed = Math.min(minWords, segWords.length - sj, hbWords.length);
  for (let i = 0; i < needed; i++) {
    const hb = normalizeHebrew(hbWords[i]);
    const seg = normalizeHebrew(segWords[sj + i]);
    if (!hb || !seg) return false;
    if (!wordsMatchFuzzy(hb, seg)) return false;
  }
  return needed >= minWords;
}
