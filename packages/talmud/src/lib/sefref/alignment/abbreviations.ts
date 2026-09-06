import { normalizeHebrew } from './index';

const FINAL_MAP: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

const GEMATRIA: Record<string, number> = {
  א: 1,
  ב: 2,
  ג: 3,
  ד: 4,
  ה: 5,
  ו: 6,
  ז: 7,
  ח: 8,
  ט: 9,
  י: 10,
  כ: 20,
  ל: 30,
  מ: 40,
  נ: 50,
  ס: 60,
  ע: 70,
  פ: 80,
  צ: 90,
  ק: 100,
  ר: 200,
  ש: 300,
  ת: 400,
};

const NUMBER_WORDS: Record<number, string[]> = {
  1: ['אחד', 'אחת'],
  2: ['שנים', 'שתים', 'שני', 'שתי', 'שניים', 'שתיים'],
  3: ['שלש', 'שלשה', 'שלוש', 'שלושה', 'שלשת', 'שלושת'],
  4: ['ארבע', 'ארבעה', 'ארבעת'],
  5: ['חמש', 'חמשה', 'חמישה', 'חמשת'],
  6: ['שש', 'ששה', 'שישה', 'ששת'],
  7: ['שבע', 'שבעה', 'שבעת'],
  8: ['שמנה', 'שמונה', 'שמנת', 'שמונת'],
  9: ['תשע', 'תשעה', 'תשעת'],
  10: ['עשר', 'עשרה', 'עשרת'],
  20: ['עשרים'],
  30: ['שלשים', 'שלושים'],
  40: ['ארבעים'],
  50: ['חמשים', 'חמישים'],
  60: ['ששים', 'שישים'],
  70: ['שבעים'],
  80: ['שמנים', 'שמונים'],
  90: ['תשעים'],
  100: ['מאה'],
  200: ['מאתים', 'מאתיים'],
};

function genericAcronymMatch(hbRaw: string, sefWords: string[], sj: number): number {
  if (!/[״"]/.test(hbRaw)) return 0;

  let letters = hbRaw.replace(/[֑-ׇ]/g, '').replace(/[^א-ת]/g, '');
  letters = letters.replace(/[ךםןףץ]/g, (m) => FINAL_MAP[m] ?? m);
  if (letters.length < 2 || letters.length > 6) return 0;

  const MAX_WORDS = 4;
  const words: string[] = [];
  for (let k = 0; k < MAX_WORDS && sj + k < sefWords.length; k++) {
    words.push(normalizeHebrew(sefWords[sj + k]));
  }

  const consume = (rem: string, wIdx: number): number => {
    if (rem === '') return wIdx;
    if (wIdx >= words.length) return 0;
    const w = words[wIdx];
    if (!w) return 0;
    if (w[0] === rem[0]) {
      const r = consume(rem.slice(1), wIdx + 1);
      if (r > 0) return r;
    }
    if (rem.length >= 2 && w.startsWith(rem.slice(0, 2))) {
      const r = consume(rem.slice(2), wIdx + 1);
      if (r > 0) return r;
    }
    return 0;
  };

  return consume(letters, 0);
}

/**
 * Return N if the HebrewBooks word at `sj` is an abbreviation whose expansion
 * matches the next N words in `sefWords`.
 */
export function abbreviationMatches(hbRaw: string, sefWords: string[], sj: number): number {
  const s = hbRaw.replace(/[֑-ׇ]/g, '').trim();
  const eq = (a: string, b: string): boolean => normalizeHebrew(a) === normalizeHebrew(b);
  const startsWith = (word: string, prefix: string): boolean =>
    normalizeHebrew(word).startsWith(normalizeHebrew(prefix));

  if (/^ר[׳'׳]$/.test(s)) {
    return sj < sefWords.length && eq(sefWords[sj], 'רבי') ? 1 : 0;
  }

  // ר"ל → ריש (Resh Lakish short form) before generic ר"X → רבי X
  if (/^ר[״"״]ל$/.test(s)) {
    if (sj < sefWords.length && (eq(sefWords[sj], 'ריש') || startsWith(sefWords[sj], 'ריש')))
      return 1;
    if (
      sj + 1 < sefWords.length &&
      eq(sefWords[sj], 'רבי') &&
      startsWith(sefWords[sj + 1], 'ל')
    )
      return 2;
    return 0;
  }

  let m = s.match(/^ר[״"״](.+)$/);
  if (m) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'רבי') && startsWith(sefWords[sj + 1], m[1]))
      return 2;
    return 0;
  }

  if (/^א[״"״]ר$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'אמר') && eq(sefWords[sj + 1], 'רבי'))
      return 2;
    return 0;
  }

  if (/^א[״"״]ל$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'אמר') && startsWith(sefWords[sj + 1], 'ל'))
      return 2;
    return 0;
  }

  if (/^וא[״"״]ר$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'ואמר') && eq(sefWords[sj + 1], 'רבי'))
      return 2;
    return 0;
  }

  // אריב"ל / ואריב"ל → אמר רבי יהושע בן לוי (common collapsed attribution)
  m = s.match(/^(ו?)אריב[״"״]ל$/);
  if (m) {
    const first = m[1] ? 'ואמר' : 'אמר';
    if (
      sj + 4 < sefWords.length &&
      eq(sefWords[sj], first) &&
      eq(sefWords[sj + 1], 'רבי') &&
      startsWith(sefWords[sj + 2], 'י') &&
      eq(sefWords[sj + 3], 'בן') &&
      startsWith(sefWords[sj + 4], 'ל')
    )
      return 5;
    if (
      sj + 2 < sefWords.length &&
      eq(sefWords[sj], first) &&
      eq(sefWords[sj + 1], 'רבי') &&
      startsWith(sefWords[sj + 2], 'י')
    )
      return 3;
    return 0;
  }

  m = s.match(/^(ו?)חכ[״"״]א$/);
  if (m) {
    const first = m[1] ? 'וחכמים' : 'חכמים';
    if (sj + 1 < sefWords.length && eq(sefWords[sj], first) && eq(sefWords[sj + 1], 'אומרים'))
      return 2;
    return 0;
  }

  if (/^ת[״"״]ר$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'תנו') && eq(sefWords[sj + 1], 'רבנן'))
      return 2;
    return 0;
  }

  if (/^ת[״"״]ש$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'תא') && eq(sefWords[sj + 1], 'שמע')) return 2;
    return 0;
  }

  if (/^ק[״"״]ו$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'קל') && eq(sefWords[sj + 1], 'וחומר'))
      return 2;
    return 0;
  }

  if (/^ק[״"״]ש$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'קריאת') && eq(sefWords[sj + 1], 'שמע'))
      return 2;
    return 0;
  }

  if (/^ד[״"״]א$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'דבר') && eq(sefWords[sj + 1], 'אחר'))
      return 2;
    return 0;
  }

  if (/^ב[״"״]ד$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'בית') && eq(sefWords[sj + 1], 'דין'))
      return 2;
    return 0;
  }

  if (/^ב[״"״]ה$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'בית') && eq(sefWords[sj + 1], 'הלל'))
      return 2;
    return 0;
  }

  if (/^ב[״"״]ש$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'בית') && eq(sefWords[sj + 1], 'שמאי'))
      return 2;
    return 0;
  }

  if (/^מ[״"״]מ$/.test(s)) {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'מכל') && eq(sefWords[sj + 1], 'מקום'))
      return 2;
    return 0;
  }

  if (/^קמ[״"״]ל$/.test(s)) {
    if (
      sj + 2 < sefWords.length &&
      eq(sefWords[sj], 'קא') &&
      eq(sefWords[sj + 1], 'משמע') &&
      eq(sefWords[sj + 2], 'לן')
    )
      return 3;
    return 0;
  }

  if (/^הקב[״"״]ה$/.test(s)) {
    if (
      sj + 2 < sefWords.length &&
      eq(sefWords[sj], 'הקדוש') &&
      eq(sefWords[sj + 1], 'ברוך') &&
      eq(sefWords[sj + 2], 'הוא')
    )
      return 3;
    return 0;
  }

  if (/^אע[״"״]פ$/.test(s)) {
    if (
      sj + 2 < sefWords.length &&
      eq(sefWords[sj], 'אף') &&
      eq(sefWords[sj + 1], 'על') &&
      eq(sefWords[sj + 2], 'פי')
    )
      return 3;
    return 0;
  }

  if (/^אע[״"״]ג$/.test(s)) {
    if (
      sj + 2 < sefWords.length &&
      eq(sefWords[sj], 'אף') &&
      eq(sefWords[sj + 1], 'על') &&
      eq(sefWords[sj + 2], 'גב')
    )
      return 3;
    return 0;
  }

  if (/^ואע[״"״]ג$/.test(s)) {
    if (
      sj + 2 < sefWords.length &&
      eq(sefWords[sj], 'ואף') &&
      eq(sefWords[sj + 1], 'על') &&
      eq(sefWords[sj + 2], 'גב')
    )
      return 3;
    return 0;
  }

  if (/^רשב[״"״]י$/.test(s)) {
    if (
      sj + 3 < sefWords.length &&
      eq(sefWords[sj], 'רבי') &&
      eq(sefWords[sj + 1], 'שמעון') &&
      eq(sefWords[sj + 2], 'בן') &&
      eq(sefWords[sj + 3], 'יוחאי')
    )
      return 4;
    return 0;
  }

  if (/^רשב[״"״]ל$/.test(s)) {
    if (
      sj + 3 < sefWords.length &&
      eq(sefWords[sj], 'רבי') &&
      eq(sefWords[sj + 1], 'שמעון') &&
      eq(sefWords[sj + 2], 'בן') &&
      eq(sefWords[sj + 3], 'לקיש')
    )
      return 4;
    return 0;
  }

  if (/^גמ[׳'׳]$/.test(s)) {
    if (sj < sefWords.length) {
      const n = normalizeHebrew(sefWords[sj]);
      if (n === 'גמ' || n === 'גמרא') return 1;
    }
    return 0;
  }

  if (/^מתני[׳'׳]$/.test(s)) {
    if (sj < sefWords.length) {
      const n = normalizeHebrew(sefWords[sj]);
      if (n === 'מתני' || n === 'מתניתין') return 1;
    }
    return 0;
  }

  // HB sometimes drops gershayim on very common abbreviations.
  if (s === 'סד') {
    if (sj + 1 < sefWords.length && eq(sefWords[sj], 'סלקא') && eq(sefWords[sj + 1], 'דעתך'))
      return 2;
    return 0;
  }
  if (s === 'קמל') {
    if (
      sj + 2 < sefWords.length &&
      eq(sefWords[sj], 'קא') &&
      eq(sefWords[sj + 1], 'משמע') &&
      eq(sefWords[sj + 2], 'לן')
    )
      return 3;
    return 0;
  }

  // מד' → מארבע (from four)
  if (/^מד[׳'״"]$/.test(s)) {
    if (sj < sefWords.length) {
      const n = normalizeHebrew(sefWords[sj]);
      if (n === 'מארבע' || n.startsWith('ארבע')) return 1;
    }
    return 0;
  }

  const bare = s.replace(/[^א-ת]/g, '');
  if (bare.length === 1 && /[׳'״"]/.test(s)) {
    const forms = NUMBER_WORDS[GEMATRIA[bare] ?? -1];
    if (forms && sj < sefWords.length) {
      const n = normalizeHebrew(sefWords[sj]);
      if (forms.some((f) => normalizeHebrew(f) === n)) return 1;
    }
  }

  return genericAcronymMatch(hbRaw, sefWords, sj);
}
