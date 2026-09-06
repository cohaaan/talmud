import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openingFingerprint, verifyDafIdentity } from '../src/lib/daf-identity';

interface SampleFixture {
  tractate: string;
  page: string;
  mainText: { hebrew: string; english: string };
  rashi?: { hebrew: string; english: string };
  tosafot?: { hebrew: string; english: string };
  _source?: string;
  mainSegmentsHe?: string[];
}

const SAMPLE_DIR = join(__dirname, '../src/fixtures/shas-sample');

function loadSample(id: string): SampleFixture {
  return JSON.parse(readFileSync(join(SAMPLE_DIR, `${id}.json`), 'utf8')) as SampleFixture;
}

const manifestPath = join(SAMPLE_DIR, 'manifest.json');
const manifest: Array<{ id: string; tractate: string; page: string }> = JSON.parse(
  readFileSync(manifestPath, 'utf8'),
);

describe('daf identity — cross-Shas sample (start/mid/end)', () => {
  it('manifest lists fixtures on disk', () => {
    const files = readdirSync(SAMPLE_DIR).filter((f) => f.endsWith('.json') && f !== 'manifest.json');
    expect(files.length).toBe(manifest.length);
  });

  for (const entry of manifest) {
    it(`${entry.tractate} ${entry.page} (${entry.id})`, () => {
      const f = loadSample(entry.id);
      expect(f._source).toBe('hebrewbooks');
      const result = verifyDafIdentity({
        tractate: f.tractate,
        page: f.page,
        data: { mainText: f.mainText, rashi: f.rashi, tosafot: f.tosafot },
        mainSegmentsHe: f.mainSegmentsHe,
        expectedMainFingerprint: openingFingerprint(f.mainText.hebrew),
      });
      expect(result.ok, result.issues.map((i) => i.message).join('; ')).toBe(true);
    });
  }
});
