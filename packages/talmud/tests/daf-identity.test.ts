import { describe, expect, it } from 'vitest';
import { fixtureById, fixtures } from '../src/fixtures';
import {
  amudPairDistinct,
  firstWords,
  mainOpensWithSegments,
  normalizePageRef,
  openingFingerprint,
  parsePageRef,
  verifyDafIdentity,
} from '../src/lib/daf-identity';
import { clampAmud } from '../src/lib/sefref/amudim';
import { sefariaPageToHebrewBooksDaf } from '../src/lib/sefref/hebrewbooks/client';

describe('page ref normalization', () => {
  it('lowercases amud and rejects pre-2a pages', () => {
    expect(normalizePageRef('2a')).toBe('2a');
    expect(normalizePageRef('2B')).toBe('2b');
    expect(normalizePageRef(' 14A ')).toBe('14a');
    expect(normalizePageRef('1a')).toBeNull();
    expect(normalizePageRef('abc')).toBeNull();
  });

  it('parsePageRef returns structured amud', () => {
    expect(parsePageRef('55b')).toEqual({ daf: 55, amud: 'b', canonical: '55b' });
  });

  it('HebrewBooks daf param normalizes uppercase amud', () => {
    expect(sefariaPageToHebrewBooksDaf('2B')).toBe('2b');
    expect(sefariaPageToHebrewBooksDaf('2a')).toBe('2');
    expect(sefariaPageToHebrewBooksDaf('12b')).toBe('12b');
  });

  it('clampAmud normalizes page casing', () => {
    expect(clampAmud('Berakhot', '2B')).toBe('2b');
  });
});

describe('daf identity — frozen fixtures', () => {
  it('every fixture has distinct main/rashi/tosafot and non-empty Gemara', () => {
    for (const f of fixtures) {
      const result = verifyDafIdentity({
        tractate: f.tractate,
        page: f.page,
        data: f.data,
        expectedMainFingerprint: openingFingerprint(f.data.mainText.hebrew),
      });
      expect(result.ok, `${f.id}: ${result.issues.map((i) => i.message).join('; ')}`).toBe(true);
      expect(result.canonicalPage).toBe(f.page);
    }
  });

  it('fixture metadata amud matches page suffix', () => {
    for (const f of fixtures) {
      expect(f.page.endsWith(f.amud)).toBe(true);
    }
  });

  it('Berakhot 2a opens with מאימתי (Vilna + Sefaria identity)', () => {
    const f = fixtureById['berakhot-2a'];
    expect(firstWords(f.data.mainText.hebrew, 1)[0]).toMatch(/^מאימת/i);
    const segments = ['מאימתי קורין את שמע בערבין משעה שהכהנים נכנסים לאכול בתרומתן'];
    expect(mainOpensWithSegments(f.data.mainText.hebrew, segments, 2)).toBe(true);
  });

  it('Berakhot 2b opens with דילמא — distinct from 2a', () => {
    const a = fixtureById['berakhot-2a'];
    const b = fixtureById['berakhot-2b'];
    expect(firstWords(b.data.mainText.hebrew, 1)[0]).toMatch(/^דילמ/i);
    expect(amudPairDistinct(a.data.mainText.hebrew, b.data.mainText.hebrew)).toBe(true);
    const segments = ['דילמא ביאת אורו הוא ומאי וטהר טהר גברא'];
    expect(mainOpensWithSegments(b.data.mainText.hebrew, segments, 2)).toBe(true);
  });

  it('Eruvin 2a/2b amud pair are distinct', () => {
    const a = fixtureById['eruvin-2a'];
    const b = fixtureById['eruvin-2b'];
    expect(amudPairDistinct(a.data.mainText.hebrew, b.data.mainText.hebrew)).toBe(true);
  });

  it('detects mis-assigned columns', () => {
    const f = fixtureById['berakhot-2a'];
    const bad = verifyDafIdentity({
      tractate: f.tractate,
      page: f.page,
      data: {
        mainText: f.data.mainText,
        rashi: { hebrew: f.data.mainText.hebrew, english: '' },
      },
    });
    expect(bad.ok).toBe(false);
    expect(bad.issues.some((i) => i.code === 'main-equals-rashi')).toBe(true);
  });

  it('detects Sefaria/HB main mismatch', () => {
    const f = fixtureById['berakhot-2a'];
    const bad = verifyDafIdentity({
      tractate: f.tractate,
      page: f.page,
      data: f.data,
      mainSegmentsHe: ['דילמא ביאת אורו הוא'],
    });
    expect(bad.ok).toBe(false);
    expect(bad.issues.some((i) => i.code === 'sefaria-main-mismatch')).toBe(true);
  });
});

describe('daf identity — cross-tractate 2a openings', () => {
  const EXPECTED_2A_FIRST: Record<string, RegExp> = {
    Berakhot: /^מאימת/i,
    Shabbat: /^יציאות/i,
    Eruvin: /^מבוי/i,
    Pesachim: /^אור/i,
    Sukkah: /^סוכה/i,
    Ketubot: /^בתולה/i,
    'Bava Kamma': /^ארבעה/i,
    Sanhedrin: /^דיני/i,
  };

  for (const [tractate, re] of Object.entries(EXPECTED_2A_FIRST)) {
    it(`${tractate} 2a fixture opens correctly`, () => {
      const f = fixtures.find((x) => x.tractate === tractate && x.page === '2a');
      expect(f, `missing ${tractate} 2a fixture`).toBeTruthy();
      const word = firstWords(f!.data.mainText.hebrew, 1)[0] ?? '';
      expect(word).toMatch(re);
    });
  }
});
