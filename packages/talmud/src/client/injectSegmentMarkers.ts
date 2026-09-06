/**
 * Align Sefaria-segmented Hebrew against the rendered HebrewBooks daf by
 * walking .daf-word spans and tagging each with `data-seg="<idx>"`.
 *
 * Differences from the naïve first version:
 *   - Uses `normalizeHebrew` from the existing alignment module, which
 *     correctly strips Hebrew gereshim (U+05F3/U+05F4) and normalizes final
 *     letters — two real mismatches the first version missed (e.g. `גמ׳`
 *     vs `גמ'`, `״וּבָא הַשֶּׁמֶשׁ״`).
 *   - Uses `wordsMatchFuzzy` for fuzzy per-word equality (handles minor
 *     orthographic drift between Sefaria and HebrewBooks).
 *   - Pre-strips HTML so `<big><strong>מֵאֵימָתַי</strong></big>` doesn't leak
 *     tag-letter noise into the word stream.
 *   - Expands common Talmudic abbreviations on the HebrewBooks side: `ר' →
 *     רבי` (1→1), `ר"י → רבי יהודה`, `א"ר → אמר רבי`, `ת"ר → תנו רבנן`,
 *     `ת"ש → תא שמע`, `קמ"ל → קא משמע לן`, `אע"פ → אף על פי` (1→N).
 *   - When a segment's opening probe doesn't match at the current scan
 *     position, we scan forward word-by-word to re-sync; the alignment is
 *     tolerant of gaps on either side.
 */

import { abbreviationMatches } from '../lib/sefref/alignment/abbreviations';
import { extractTalmudContent, normalizeHebrew, wordsMatchFuzzy } from '../lib/sefref/alignment';

export interface SegmentStats {
  totalSegments: number;
  alignedSegments: number;
  totalWords: number;
  alignedWords: number;
}

export { abbreviationMatches } from '../lib/sefref/alignment/abbreviations';

/**
 * Does `hbRaw` match `sefWord` directly (fuzzy equality on normalized forms)?
 * This is the base case; `abbreviationMatches` handles 1-to-N expansions.
 */
function singleWordMatch(hbRaw: string, sefWord: string): boolean {
  if (!sefWord) return false;
  const n1 = normalizeHebrew(hbRaw);
  const n2 = normalizeHebrew(sefWord);
  if (!n1 || !n2) return false;
  return wordsMatchFuzzy(n1, n2);
}

export function injectSegmentMarkers(
  html: string,
  segmentsHe: string[],
): { html: string; stats: SegmentStats } {
  if (!html || typeof document === 'undefined' || segmentsHe.length === 0) {
    return {
      html,
      stats: {
        totalSegments: segmentsHe.length,
        alignedSegments: 0,
        totalWords: 0,
        alignedWords: 0,
      },
    };
  }

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const words = Array.from(doc.body.querySelectorAll<HTMLSpanElement>('.daf-word'));
  if (words.length === 0) {
    return {
      html,
      stats: {
        totalSegments: segmentsHe.length,
        alignedSegments: 0,
        totalWords: 0,
        alignedWords: 0,
      },
    };
  }

  // Raw text per rendered daf-word (preserves punctuation so abbreviation
  // detection can read the geresh/gershayim).
  const wordRaw = words.map((el) => (el.textContent ?? '').trim());

  // For each Sefaria segment, strip HTML, then split into words. Also keep
  // the empty-after-normalization marker list so we can skip such tokens.
  const segWordLists: string[][] = segmentsHe.map((seg) => {
    const plain = extractTalmudContent(seg);
    return plain.split(/\s+/).filter((w) => !!normalizeHebrew(w));
  });

  let hbPtr = 0;
  let alignedSegments = 0;
  let alignedWords = 0;

  for (let segIdx = 0; segIdx < segWordLists.length; segIdx++) {
    const segWords = segWordLists[segIdx];
    if (segWords.length === 0) continue;

    // Find the segment's start. Scan forward from hbPtr; at each candidate
    // position, try to consume the first 3 Sefaria words (or the whole
    // segment if shorter) using singleWordMatch + abbreviationMatches. If
    // we can, that's the start.
    const needed = Math.min(3, segWords.length);
    let segStart = -1;

    // Scan forward for a starting position where we can consume at least
    // `needed` Sefaria words of this segment in order — via either single-word
    // matches or 1-to-N abbreviation expansions. The counter `sj` measures
    // Sefaria-word progress (not HB iterations), so `א"ר + יצחק` correctly
    // consumes 3 Sefaria words from only 2 HB iterations.
    for (let i = hbPtr; i < words.length; i++) {
      let hb = i;
      let sj = 0;
      while (sj < needed && hb < words.length) {
        const raw = wordRaw[hb];
        if (!normalizeHebrew(raw)) {
          hb++;
          continue;
        }
        const abbrev = abbreviationMatches(raw, segWords, sj);
        if (abbrev > 0) {
          hb++;
          sj += abbrev;
          continue;
        }
        if (singleWordMatch(raw, segWords[sj])) {
          hb++;
          sj++;
          continue;
        }
        break;
      }
      if (sj >= needed) {
        segStart = i;
        break;
      }
    }

    if (segStart < 0) continue;

    // Consume the full segment from segStart. A small lookahead on both
    // sides tolerates single-word insertions/deletions without aborting the
    // whole segment (e.g. a stray punctuation-word in HB, or a Sefaria-only
    // editorial gloss). Up to 2 consecutive unmatchable words are skipped.
    let sj = 0;
    let i = segStart;
    while (sj < segWords.length && i < words.length) {
      const raw = wordRaw[i];
      if (!normalizeHebrew(raw)) {
        i++;
        continue;
      }
      const abbrev = abbreviationMatches(raw, segWords, sj);
      if (abbrev > 0) {
        words[i].setAttribute('data-seg', String(segIdx));
        i++;
        sj += abbrev;
        alignedWords++;
        continue;
      }
      if (singleWordMatch(raw, segWords[sj])) {
        words[i].setAttribute('data-seg', String(segIdx));
        i++;
        sj++;
        alignedWords++;
        continue;
      }
      // No direct match. Try a 1-word lookahead on either side.
      let recovered = false;
      for (let look = 1; look <= 2 && !recovered; look++) {
        // Skip one HB word (insertion in HB).
        if (i + look < words.length) {
          const ahead = wordRaw[i + look];
          if (
            normalizeHebrew(ahead) &&
            (abbreviationMatches(ahead, segWords, sj) > 0 || singleWordMatch(ahead, segWords[sj]))
          ) {
            i += look;
            recovered = true;
            break;
          }
        }
        // Skip one Sefaria word (deletion in HB).
        if (sj + look < segWords.length) {
          if (
            abbreviationMatches(raw, segWords, sj + look) > 0 ||
            singleWordMatch(raw, segWords[sj + look])
          ) {
            sj += look;
            recovered = true;
            break;
          }
        }
      }
      if (recovered) continue;
      break;
    }

    alignedSegments++;
    hbPtr = i;
  }

  return {
    html: doc.body.innerHTML,
    stats: {
      totalSegments: segmentsHe.length,
      alignedSegments,
      totalWords: words.length,
      alignedWords,
    },
  };
}
