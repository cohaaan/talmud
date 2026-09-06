import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  amudPairDistinct,
  firstWords,
  mainOpensWithSegments,
  openingFingerprint,
  verifyDafIdentity,
} from '../src/lib/daf-identity';

interface BmFixtureFile {
  mainText: { hebrew: string; english: string };
  rashi?: { hebrew: string; english: string };
  tosafot?: { hebrew: string; english: string };
  _source?: string;
  mainSegmentsHe?: string[];
}

const FIXTURE_DIR = join(__dirname, '../src/fixtures');

function loadBm(page: string): BmFixtureFile {
  const raw = readFileSync(join(FIXTURE_DIR, `bava-metzia-${page}.json`), 'utf8');
  return JSON.parse(raw) as BmFixtureFile;
}

const TRACTATE = 'Bava Metzia';
const SAMPLE_PAGES = ['2a', '2b', '30a', '59a', '60a', '119a'] as const;

describe('daf identity — Bava Metzia (frozen HB fixtures)', () => {
  for (const page of SAMPLE_PAGES) {
    it(`${TRACTATE} ${page} passes identity checks`, () => {
      const f = loadBm(page);
      expect(f._source).toBe('hebrewbooks');
      const result = verifyDafIdentity({
        tractate: TRACTATE,
        page,
        data: {
          mainText: f.mainText,
          rashi: f.rashi,
          tosafot: f.tosafot,
        },
        mainSegmentsHe: f.mainSegmentsHe,
        expectedMainFingerprint: openingFingerprint(f.mainText.hebrew),
      });
      expect(result.ok, result.issues.map((i) => i.message).join('; ')).toBe(true);
    });
  }

  it('2a opens with שנים (Eilu Metzios mishna body — אלו מציאות is the chapter name, not page text)', () => {
    const f = loadBm('2a');
    expect(firstWords(f.mainText.hebrew, 1)[0]).toMatch(/^שנ/i);
    const segments = [
      'שְׁנַיִם אוֹחֲזִין בְּטַלִּית, זֶה אוֹמֵר: ״אֲנִי מְצָאתִיהָ״, וְזֶה אוֹמֵר: ״אֲנִי מְצָאתִיהָ״.',
    ];
    expect(mainOpensWithSegments(f.mainText.hebrew, segments, 2)).toBe(true);
  });

  it('2a and 2b are distinct amudim', () => {
    const a = loadBm('2a');
    const b = loadBm('2b');
    expect(amudPairDistinct(a.mainText.hebrew, b.mainText.hebrew)).toBe(true);
  });

  it('start / mid / end sample pages have distinct openings', () => {
    const fps = SAMPLE_PAGES.map((p) => openingFingerprint(loadBm(p).mainText.hebrew, 8));
    expect(new Set(fps).size).toBe(fps.length);
  });

  it('59a (Tanur shel Akhnai locale) has non-empty commentary columns', () => {
    const f = loadBm('59a');
    expect((f.rashi?.hebrew?.length ?? 0) > 100).toBe(true);
    expect((f.tosafot?.hebrew?.length ?? 0) > 100).toBe(true);
  });

  it('119a (tractate end) is within Vilna bounds and non-empty', () => {
    const f = loadBm('119a');
    expect(f.mainText.hebrew.length).toBeGreaterThan(100);
  });
});
