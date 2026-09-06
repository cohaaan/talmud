import { describe, expect, it } from 'vitest';
import {
  formatPerekHeaderLine,
  parsePerekFromMishnaRef,
  perekNameFromAlt,
  perekNameOnPage,
  perekNamesToCache,
  perekNumberHe,
  primaryPerekFromMishnaRefs,
  resolveRunningPerekHeader,
} from '../src/lib/sefref/perek';

describe('perek header helpers', () => {
  it('parsePerekFromMishnaRef extracts chapter number', () => {
    expect(parsePerekFromMishnaRef('Mishnah Bava Metzia 5:1')).toBe(5);
    expect(parsePerekFromMishnaRef('Mishnah Berakhot 1:1-2')).toBe(1);
    expect(parsePerekFromMishnaRef('Bava Metzia 2a')).toBeNull();
  });

  it('perekNameFromAlt reads whole-chapter Sefaria alt', () => {
    expect(perekNameFromAlt({ he: ['שנים אוחזין'], whole: true })).toBe('שנים אוחזין');
    expect(perekNameFromAlt({ he: ['foo'], whole: false })).toBeNull();
  });

  it('resolveRunningPerekHeader prefers on-page alt', () => {
    const alts = [{ he: ['איזהו נשך'], whole: true }];
    const header = resolveRunningPerekHeader({
      alts,
      mishnaRefs: ['Mishnah Bava Metzia 5:1'],
      cachedNameByPerek: {},
    });
    expect(header).toEqual({ perekNum: 5, nameHe: 'איזהו נשך' });
  });

  it('resolveRunningPerekHeader falls back to cached name', () => {
    const header = resolveRunningPerekHeader({
      alts: [],
      mishnaRefs: ['Mishnah Bava Metzia 3:2'],
      cachedNameByPerek: { 3: 'המפקיד' },
    });
    expect(header).toEqual({ perekNum: 3, nameHe: 'המפקיד' });
  });

  it('resolveRunningPerekHeader uses gematria when no name known', () => {
    const header = resolveRunningPerekHeader({
      alts: [null, null],
      mishnaRefs: ['Mishnah Bava Metzia 3:2'],
      cachedNameByPerek: {},
    });
    expect(header).toEqual({ perekNum: 3, nameHe: 'ג' });
  });

  it('perekNameOnPage finds first whole alt', () => {
    expect(perekNameOnPage([null, null, { he: ['מאימתי'], whole: true }])).toBe('מאימתי');
  });

  it('primaryPerekFromMishnaRefs picks earliest chapter', () => {
    expect(primaryPerekFromMishnaRefs(['Mishnah Bava Metzia 2:3', 'Mishnah Bava Metzia 1:1'])).toBe(
      1,
    );
  });

  it('perekNamesToCache collects names for KV warm', () => {
    const entries = perekNamesToCache(
      [{ he: ['שנים אוחזין'], whole: true }],
      ['Mishnah Bava Metzia 1:1'],
    );
    expect(entries).toContainEqual({ perekNum: 1, nameHe: 'שנים אוחזין' });
  });

  it('formatPerekHeaderLine prefixes פרק', () => {
    expect(formatPerekHeaderLine({ perekNum: 5, nameHe: 'איזהו נשך' })).toBe('פרק איזהו נשך');
    expect(formatPerekHeaderLine({ perekNum: 3, nameHe: 'ג' })).toBe('פרק ג');
  });

  it('perekNumberHe handles teens', () => {
    expect(perekNumberHe(15)).toBe('טו');
    expect(perekNumberHe(16)).toBe('טז');
    expect(perekNumberHe(10)).toBe('י');
  });
});
