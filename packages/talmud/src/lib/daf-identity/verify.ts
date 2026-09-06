import type { TalmudPageData } from '../sefref';
import { isValidAmud } from '../sefref/amudim';
import { extractWords, firstWords, mainOpensWithSegments, openingFingerprint } from './extract';
import { normalizePageRef, parsePageRef } from './page-ref';

export interface DafIdentityInput {
  tractate: string;
  page: string;
  data: Pick<TalmudPageData, 'mainText' | 'rashi' | 'tosafot'>;
  /** Sefaria v3 segment array — when present, HB main must open with segment 0. */
  mainSegmentsHe?: string[];
  /** When set, main opening must match this fingerprint (fixture golden). */
  expectedMainFingerprint?: string;
}

export interface DafIdentityIssue {
  level: 'error' | 'warn';
  code: string;
  message: string;
}

export interface DafIdentityResult {
  ok: boolean;
  tractate: string;
  page: string;
  canonicalPage: string | null;
  issues: DafIdentityIssue[];
  stats: {
    mainWords: number;
    rashiWords: number;
    tosafotWords: number;
    mainFingerprint: string;
  };
}

const MIN_MAIN_WORDS = 8;
const MIN_MAIN_WORDS_WARN = 12;

function columnsLikelyDistinct(main: string, rashi: string): boolean {
  if (!main || !rashi) return true;
  if (openingFingerprint(main, 20) !== openingFingerprint(rashi, 20)) return true;
  if (openingFingerprint(main, 40) !== openingFingerprint(rashi, 40)) return true;
  if (openingFingerprint(main, 60) !== openingFingerprint(rashi, 60)) return true;
  return false;
}

export function verifyDafIdentity(input: DafIdentityInput): DafIdentityResult {
  const issues: DafIdentityIssue[] = [];
  const canonical = normalizePageRef(input.page);
  const parsed = parsePageRef(input.page);

  if (!canonical || !parsed) {
    issues.push({
      level: 'error',
      code: 'invalid-page-ref',
      message: `Malformed page ref "${input.page}" — expected Na/Nb with daf ≥ 2`,
    });
  } else if (!isValidAmud(input.tractate, canonical)) {
    issues.push({
      level: 'error',
      code: 'out-of-range',
      message: `${input.tractate} ${canonical} is outside the tractate's Vilna bounds`,
    });
  }

  const main = input.data.mainText?.hebrew ?? '';
  const rashi = input.data.rashi?.hebrew ?? '';
  const tosafot = input.data.tosafot?.hebrew ?? '';
  const mainWords = extractWords(main);
  const rashiWords = extractWords(rashi);
  const tosafotWords = extractWords(tosafot);
  const fp = openingFingerprint(main);

  if (mainWords.length === 0) {
    const tosafotWords = extractWords(tosafot);
    const commentaryOnly =
      (input.mainSegmentsHe?.length ?? 0) === 0 && tosafotWords.length > 40;
    if (!commentaryOnly) {
      issues.push({
        level: 'error',
        code: 'empty-main',
        message: 'Gemara column is empty — likely wrong amud or extract failure',
      });
    }
  } else if (mainWords.length < MIN_MAIN_WORDS) {
    issues.push({
      level: 'error',
      code: 'short-main',
      message: `Gemara column unusually short (${mainWords.length} words) — may be truncated`,
    });
  } else if (mainWords.length < MIN_MAIN_WORDS_WARN) {
    issues.push({
      level: 'warn',
      code: 'short-main',
      message: `Gemara column unusually short (${mainWords.length} words) — may be truncated`,
    });
  }

  if (rashi && rashiWords.length === 0) {
    issues.push({
      level: 'warn',
      code: 'empty-rashi-markup',
      message: 'Rashi HTML present but no extractable words',
    });
  }
  if (tosafot && tosafotWords.length === 0) {
    issues.push({
      level: 'warn',
      code: 'empty-tosafot-markup',
      message: 'Tosafot HTML present but no extractable words',
    });
  }

  if (main && rashi && !columnsLikelyDistinct(main, rashi)) {
    issues.push({
      level: 'error',
      code: 'main-equals-rashi',
      message: 'Main Gemara text matches Rashi opening — columns likely mis-assigned',
    });
  }
  if (main && tosafot && openingFingerprint(main, 20) === openingFingerprint(tosafot, 20)) {
    issues.push({
      level: 'error',
      code: 'main-equals-tosafot',
      message: 'Main Gemara text matches Tosafot opening — columns likely mis-assigned',
    });
  }

  const segments = input.mainSegmentsHe ?? [];
  if (segments.length > 0 && mainWords.length > 0) {
    if (!mainOpensWithSegments(main, segments, 2)) {
      issues.push({
        level: 'error',
        code: 'sefaria-main-mismatch',
        message: `HB Gemara opening (${firstWords(main, 3).join(' ')}) does not match Sefaria segment 0 (${firstWords(segments[0], 3).join(' ')})`,
      });
    }
  }

  if (input.expectedMainFingerprint && fp !== input.expectedMainFingerprint) {
    issues.push({
      level: 'error',
      code: 'golden-mismatch',
      message: `Main opening fingerprint changed — expected fixture identity for ${input.tractate} ${input.page}`,
    });
  }

  const ok = !issues.some((i) => i.level === 'error');
  return {
    ok,
    tractate: input.tractate,
    page: input.page,
    canonicalPage: canonical,
    issues,
    stats: {
      mainWords: mainWords.length,
      rashiWords: rashiWords.length,
      tosafotWords: tosafotWords.length,
      mainFingerprint: fp,
    },
  };
}

/** Two amudim of the same daf number must not share the same main opening. */
export function amudPairDistinct(mainA: string, mainB: string, wordCount = 8): boolean {
  const fpA = openingFingerprint(mainA, wordCount);
  const fpB = openingFingerprint(mainB, wordCount);
  return fpA !== fpB && fpA.length > 0 && fpB.length > 0;
}
