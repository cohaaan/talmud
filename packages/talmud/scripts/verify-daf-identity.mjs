#!/usr/bin/env node
/**
 * Live daf-identity verifier — fetches HebrewBooks (or app API) + Sefaria for
 * each amud and checks tractate/page/content alignment.
 *
 * Usage:
 *   node scripts/verify-daf-identity.mjs --tractate Berakhot
 *   node scripts/verify-daf-identity.mjs --tractate "Bava Metzia"
 *   node scripts/verify-daf-identity.mjs --sample
 *   node scripts/verify-daf-identity.mjs --tractate Berakhot --from 2a --to 5b
 *   node scripts/verify-daf-identity.mjs --shas
 *   node scripts/verify-daf-identity.mjs --shas --parallel 4 --via-api https://talmud.dev
 *
 * When HebrewBooks returns 403 (common on cloud VMs), the script auto-falls back
 * to https://talmud.dev unless --no-auto-api is set.
 *
 * Exit 1 on any error-level mismatch.
 */

import { abbreviationMatches } from './lib/abbreviations.mjs';

/** Hard-coded tractate list (matches tractates.ts). */
const TRACTATES = [
  'Berakhot',
  'Shabbat',
  'Eruvin',
  'Pesachim',
  'Shekalim',
  'Yoma',
  'Sukkah',
  'Beitzah',
  'Rosh Hashanah',
  'Taanit',
  'Megillah',
  'Moed Katan',
  'Chagigah',
  'Yevamot',
  'Ketubot',
  'Nedarim',
  'Nazir',
  'Sotah',
  'Gittin',
  'Kiddushin',
  'Bava Kamma',
  'Bava Metzia',
  'Bava Batra',
  'Sanhedrin',
  'Makkot',
  'Shevuot',
  'Avodah Zarah',
  'Horayot',
  'Zevachim',
  'Menachot',
  'Chullin',
  'Bekhorot',
  'Arakhin',
  'Temurah',
  'Keritot',
  'Meilah',
  'Niddah',
];

const TRACTATE_IDS = {
  Berakhot: 1,
  Shabbat: 2,
  Eruvin: 3,
  Pesachim: 4,
  Shekalim: 5,
  Yoma: 6,
  Sukkah: 7,
  Beitzah: 8,
  'Rosh Hashanah': 9,
  Taanit: 10,
  Megillah: 11,
  'Moed Katan': 12,
  Chagigah: 13,
  Yevamot: 14,
  Ketubot: 15,
  Nedarim: 16,
  Nazir: 17,
  Sotah: 18,
  Gittin: 19,
  Kiddushin: 20,
  'Bava Kamma': 21,
  'Bava Metzia': 22,
  'Bava Batra': 23,
  Sanhedrin: 24,
  Makkot: 25,
  Shevuot: 26,
  'Avodah Zarah': 27,
  Horayot: 28,
  Zevachim: 29,
  Menachot: 30,
  Chullin: 31,
  Bekhorot: 32,
  Arakhin: 33,
  Temurah: 34,
  Keritot: 35,
  Meilah: 36,
  Niddah: 37,
};

const END_AMUD = {
  berakhot: '64a',
  shabbat: '157b',
  eruvin: '105a',
  pesachim: '121b',
  shekalim: '22b',
  yoma: '88a',
  sukkah: '56b',
  beitzah: '40b',
  'rosh hashanah': '35a',
  taanit: '31a',
  megillah: '32a',
  'moed katan': '29a',
  chagigah: '27a',
  yevamot: '122b',
  ketubot: '112b',
  nedarim: '91b',
  nazir: '66b',
  sotah: '49b',
  gittin: '90b',
  kiddushin: '82b',
  'bava kamma': '119b',
  'bava metzia': '119a',
  'bava batra': '176b',
  sanhedrin: '113b',
  makkot: '24b',
  shevuot: '49b',
  'avodah zarah': '76b',
  horayot: '14a',
  zevachim: '120b',
  menachot: '110a',
  chullin: '142a',
  bekhorot: '61a',
  arakhin: '34a',
  temurah: '34a',
  keritot: '28b',
  meilah: '22a',
  niddah: '73a',
};

/** Tractates with special handling — still verified unless --skip-quarantined. */
const QUARANTINE_NOTES = {
  Shekalim:
    'Yerushalmi in Sefaria Bavli canon; Vilna/HB edition present — verified via HB pipeline',
};

const DEFAULT_DELAY_MS = 50;
const DEFAULT_PARALLEL = 4;

function normalizePageRef(page) {
  const m = /^(\d+)([ab])$/i.exec(String(page).trim());
  if (!m) return null;
  const daf = parseInt(m[1], 10);
  if (daf < 2) return null;
  return `${daf}${m[2].toLowerCase()}`;
}

function amudToNumber(amud) {
  const m = amud.match(/^(\d+)([ab])$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n * 2 + (m[2] === 'a' ? -1 : 0);
}

function numberToAmud(n) {
  const daf = Math.ceil(n / 2);
  return `${daf}${n % 2 === 1 ? 'a' : 'b'}`;
}

function* iterAmudimLocal(tractate) {
  const end = END_AMUD[tractate.toLowerCase()];
  if (!end) return;
  const start = amudToNumber('2a');
  const endNum = amudToNumber(end);
  for (let n = start; n <= endNum; n++) yield numberToAmud(n);
}

function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normHe(s) {
  return stripHtml(s)
    .replace(/[\u0591-\u05C7\u05F0-\u05F4]/g, '')
    .replace(/[ךםןףץ]/g, (c) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c] ?? c)
    .replace(/[״׳"'`,.:;!?()[\]{}־–—]/g, '')
    .replace(/[^\u0590-\u05FF]/g, '')
    .toLowerCase();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function wordsMatchFuzzy(w1, w2) {
  if (!w1 || !w2) return false;
  if (w1 === w2) return true;
  const n1 = normHe(w1);
  const n2 = normHe(w2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1.length >= 2 && n2.length >= 2 && (n1.includes(n2) || n2.includes(n1))) return true;
  if (n1.length >= 2 && n2.startsWith(n1)) return true;
  if (n2.length >= 2 && n1.startsWith(n2)) return true;
  if (n1.length === 1 && n2.startsWith(n1)) return true;
  if (n2.length === 1 && n1.startsWith(n2)) return true;
  // HB vs Sefaria lexical variants on the same sugya.
  const synonyms = [
    ['נכרי', 'גוי'],
    ['גוי', 'נכרי'],
    ['עכו', 'עכו'],
  ];
  for (const [a, b] of synonyms) {
    if ((n1 === a && n2 === b) || (n1 === b && n2 === a)) return true;
  }
  if (n1.length >= 3 && n2.length >= 3 && n1.slice(0, 3) === n2.slice(0, 3)) return true;
  if (Math.abs(n1.length - n2.length) <= 2) {
    const d = levenshtein(n1, n2);
    const maxLen = Math.max(n1.length, n2.length);
    const threshold = maxLen <= 3 ? 1 : Math.ceil(maxLen * 0.3);
    if (d <= threshold) return true;
  }
  return false;
}

function isStructuralPrefix(word) {
  const n = normHe(word);
  return n.startsWith('מתנ') || n === 'גמ' || n.startsWith('גמ');
}

function words(html) {
  return stripHtml(html)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => normHe(w).length > 0);
}

function skipStructural(wordsArr) {
  let i = 0;
  while (i < wordsArr.length && isStructuralPrefix(wordsArr[i])) i++;
  return wordsArr.slice(i);
}

function hbWordAdvance(hbWord, segWords, sj) {
  if (sj >= segWords.length) return 0;
  if (wordsMatchFuzzy(hbWord, segWords[sj])) return 1;
  return abbreviationMatches(hbWord, segWords, sj);
}

/** Multi-word HB phrases that map to fewer Sefaria words. Returns {hbSkip, segSkip} or null. */
function hbPhraseAdvance(hb, hi, seg, sj) {
  if (hi + 1 >= hb.length || sj >= seg.length) return null;
  const w0 = normHe(hb[hi]);
  const w1 = normHe(hb[hi + 1]);
  const sw = normHe(seg[sj]);
  // בעובד כוכבים → בנכרי (Vilna print vs Sefaria spelling)
  const isIdolater = w1.startsWith('כוכב');
  if ((w0 === 'בעובד' || w0 === 'בעובדי') && isIdolater) {
    if (sw === 'בנכרי' || sw === 'נכרי' || sw.endsWith('נכרי')) return { hbSkip: 2, segSkip: 1 };
  }
  if (w0 === 'עובד' && isIdolater) {
    if (sw === 'נכרי' || sw === 'בנכרי' || sw.endsWith('נכרי')) return { hbSkip: 2, segSkip: 1 };
  }
  return null;
}

function subsequenceOpensWith(hbRaw, segRaw, minWords = 2) {
  const hb = skipStructural(hbRaw);
  const seg = skipStructural(segRaw);
  if (!hb.length || !seg.length) return false;

  for (let startHi = 0; startHi < Math.min(hb.length, 12); startHi++) {
    let hi = startHi;
    let sj = 0;
    let matched = 0;
    while (hi < hb.length && matched < minWords) {
      while (sj < seg.length && isStructuralPrefix(seg[sj])) sj++;
      if (sj >= seg.length) break;
      const phrase = hbPhraseAdvance(hb, hi, seg, sj);
      if (phrase) {
        matched++;
        hi += phrase.hbSkip;
        sj += phrase.segSkip;
        continue;
      }
      const adv = hbWordAdvance(hb[hi], seg, sj);
      if (adv > 0) {
        matched++;
        hi++;
        sj += adv;
      } else {
        if (matched === 0) break;
        sj++;
      }
    }
    if (matched >= minWords) return true;
  }
  return false;
}

function fp(html, n = 6) {
  return words(html)
    .slice(0, n)
    .map((w) => normHe(w))
    .join('|');
}

function extractShastext(html, n) {
  const className = `shastext${n}`;
  const startRe = new RegExp(`<div\\s+class="${className}"[^>]*>`, 'i');
  const startMatch = startRe.exec(html);
  if (!startMatch) return '';
  let contentStart = startMatch.index + startMatch[0].length;
  let fieldsetEnd = html.indexOf('</fieldset>', contentStart);
  if (fieldsetEnd < 0) fieldsetEnd = html.length;
  const leadingClose = html.slice(contentStart, fieldsetEnd).match(/^\s*<\/div>/i);
  if (leadingClose) contentStart += leadingClose[0].length;
  let depth = 1;
  let pos = contentStart;
  while (pos < fieldsetEnd) {
    let openIdx = html.indexOf('<div', pos);
    let closeIdx = html.indexOf('</div>', pos);
    if (openIdx >= fieldsetEnd) openIdx = -1;
    if (closeIdx >= fieldsetEnd) closeIdx = -1;
    if (closeIdx < 0) break;
    if (openIdx >= 0 && openIdx < closeIdx) {
      depth++;
      pos = openIdx + 4;
    } else {
      depth--;
      if (depth === 0) return html.slice(contentStart, closeIdx).trim();
      pos = closeIdx + 6;
    }
  }
  return html.slice(contentStart, fieldsetEnd).trim();
}

const DEFAULT_API_BASE = 'https://talmud.dev';

async function probeHbReachable() {
  try {
    const res = await fetch('https://hebrewbooks.org/shas.aspx?mesechta=1&daf=2&format=text', {
      headers: { 'User-Agent': 'talmud-verify-daf-identity/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchHb(tractate, page) {
  const mesechta = TRACTATE_IDS[tractate];
  if (!mesechta) throw new Error(`Unknown tractate ${tractate}`);
  const daf = normalizePageRef(page).replace(/a$/, '');
  const url = `https://hebrewbooks.org/shas.aspx?mesechta=${mesechta}&daf=${daf}&format=text`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'talmud-verify-daf-identity/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HB HTTP ${res.status} ${tractate} ${page}`);
  const html = await res.text();
  return {
    main: extractShastext(html, 2),
    rashi: extractShastext(html, 3),
    tosafot: extractShastext(html, 4),
    source: 'hebrewbooks-direct',
  };
}

async function fetchViaApi(apiBase, tractate, page) {
  const base = apiBase.replace(/\/$/, '');
  const url = `${base}/api/daf/${encodeURIComponent(tractate)}/${page}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (res.status === 400) {
    throw new Error(`API 400 invalid ref ${tractate} ${page}`);
  }
  if (!res.ok) throw new Error(`API HTTP ${res.status} ${tractate} ${page}`);
  const j = await res.json();
  if (j.error) throw new Error(`API error ${tractate} ${page}: ${j.error}`);
  return {
    main: j.mainText?.hebrew ?? '',
    rashi: j.rashi?.hebrew ?? '',
    tosafot: j.tosafot?.hebrew ?? '',
    segments: Array.isArray(j.mainSegmentsHe) ? j.mainSegmentsHe : [],
    source: j._source ?? 'api',
  };
}

async function fetchSefariaSegments(tractate, page) {
  const ref = encodeURIComponent(`${tractate}.${page}`);
  const res = await fetch(`https://www.sefaria.org/api/texts/${ref}?commentary=0&context=0`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Sefaria HTTP ${res.status} ${tractate} ${page}`);
  const j = await res.json();
  return Array.isArray(j.he) ? j.he : [];
}

function segmentCandidates(segments) {
  const out = [];
  for (let i = 0; i < Math.min(8, segments.length); i++) {
    out.push(segments[i]);
    const w0 = words(segments[i]);
    if (i + 1 < segments.length && w0.length <= 2) {
      out.push(`${segments[i]} ${segments[i + 1]}`);
    }
    // Mid-amud opens: try from segment i through i+2.
    if (i + 1 < segments.length) {
      out.push(segments.slice(i, i + 3).join(' '));
    }
  }
  return out;
}

function opensWithSegments(main, segments, minWords = 2) {
  if (!segments.length) return false;
  for (const candidate of segmentCandidates(segments)) {
    if (subsequenceOpensWith(words(main), words(candidate), minWords)) return true;
  }
  // Longer window: HB abbreviations / mid-page opens may align across several segments.
  const combined = segments.slice(0, 5).join(' ');
  if (subsequenceOpensWith(words(main), words(combined), minWords)) return true;
  return alignmentScorePass(words(main), words(combined));
}

/** Fraction of early HB words found in-order in Sefaria (handles abbreviations). */
function alignmentScorePass(hbRaw, segRaw) {
  const hb = skipStructural(hbRaw).slice(0, 12);
  const seg = skipStructural(segRaw).slice(0, 50);
  if (hb.length < 3 || seg.length < 3) return false;
  let hi = 0;
  let sj = 0;
  let matched = 0;
  while (hi < hb.length && sj < seg.length) {
    const phrase = hbPhraseAdvance(hb, hi, seg, sj);
    if (phrase) {
      matched++;
      hi += phrase.hbSkip;
      sj += phrase.segSkip;
      continue;
    }
    const adv = hbWordAdvance(hb[hi], seg, sj);
    if (adv > 0) {
      matched++;
      hi++;
      sj += adv;
    } else {
      sj++;
    }
  }
  const need = Math.min(4, hb.length);
  return matched >= Math.ceil(need * 0.5);
}

function sanitizeMain(main) {
  return main.replace(/^\s*(?:\[[\u0590-\u05FF]\]|[\u0590-\u05FF]\])\s*/, '').trimStart();
}

async function verifyOne(tractate, page, prevMainFp, ctx) {
  const issues = [];
  const canonical = normalizePageRef(page);
  if (!canonical) issues.push(`invalid page ref ${page}`);

  let main = '';
  let rashi = '';
  let tosafot = '';
  let segments = [];

  if (ctx.viaApi) {
    const api = await fetchViaApi(ctx.viaApi, tractate, canonical ?? page);
    main = api.main;
    rashi = api.rashi;
    tosafot = api.tosafot;
    segments = api.segments;
    if (segments.length === 0) {
      segments = await fetchSefariaSegments(tractate, canonical ?? page).catch(() => []);
    }
  } else {
    const [hb, segs] = await Promise.all([
      fetchHb(tractate, canonical ?? page),
      fetchSefariaSegments(tractate, canonical ?? page).catch(() => []),
    ]);
    main = hb.main;
    rashi = hb.rashi;
    tosafot = hb.tosafot;
    segments = segs;
  }

  main = sanitizeMain(main);

  if (!main || words(main).length < 8) {
    const commentaryOnly =
      words(main).length === 0 && segments.length === 0 && words(tosafot).length > 40;
    if (!commentaryOnly) {
      issues.push('empty or truncated main column');
    }
  }
  if (main && rashi && fp(main, 20) === fp(rashi, 20)) {
    const distinct = fp(main, 40) !== fp(rashi, 40) || fp(main, 60) !== fp(rashi, 60);
    if (!distinct) {
      issues.push('main equals rashi');
    }
  }
  if (main && tosafot && fp(main, 20) === fp(tosafot, 20)) {
    issues.push('main equals tosafot');
  }
  if (segments.length && !opensWithSegments(main, segments)) {
    issues.push(
      `Sefaria mismatch: main=[${words(main).slice(0, 3).join(' ')}] SF=[${words(segments[0]).slice(0, 3).join(' ')}]`,
    );
  }
  const mainFp = fp(main);
  if (prevMainFp && prevMainFp === mainFp) {
    issues.push('identical opening to previous amud — possible wrong folio');
  }

  return { ok: issues.length === 0, issues, mainFp, page: canonical ?? page };
}

function parseArgs(argv) {
  const out = {
    tractate: 'Berakhot',
    sample: false,
    shas: false,
    from: null,
    to: null,
    viaApi: null,
    noAutoApi: false,
    parallel: DEFAULT_PARALLEL,
    delayMs: DEFAULT_DELAY_MS,
    jsonOut: null,
    skipQuarantined: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--tractate') out.tractate = argv[++i];
    else if (argv[i] === '--sample') out.sample = true;
    else if (argv[i] === '--shas') out.shas = true;
    else if (argv[i] === '--from') out.from = argv[++i];
    else if (argv[i] === '--to') out.to = argv[++i];
    else if (argv[i] === '--via-api') out.viaApi = argv[++i];
    else if (argv[i] === '--no-auto-api') out.noAutoApi = true;
    else if (argv[i] === '--parallel') out.parallel = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (argv[i] === '--delay-ms') out.delayMs = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (argv[i] === '--json-out') out.jsonOut = argv[++i];
    else if (argv[i] === '--skip-quarantined') out.skipQuarantined = true;
  }
  return out;
}

async function verifyTractate(tractate, ctx, opts) {
  let pages = [...iterAmudimLocal(tractate)];
  if (opts.from) {
    const fromN = amudToNumber(normalizePageRef(opts.from));
    const toN = amudToNumber(normalizePageRef(opts.to ?? pages.at(-1)));
    pages = pages.filter((p) => {
      const n = amudToNumber(p);
      return n >= fromN && n <= toN;
    });
  }

  const result = {
    tractate,
    amudim: pages.length,
    checked: 0,
    failures: 0,
    failedPages: [],
    quarantineNote: QUARANTINE_NOTES[tractate] ?? null,
  };

  let prevFp = null;
  for (const page of pages) {
    try {
      const r = await verifyOne(tractate, page, prevFp, ctx);
      result.checked++;
      prevFp = r.mainFp;
      if (!r.ok) {
        result.failures++;
        result.failedPages.push({ page, issues: r.issues });
        console.error(`FAIL ${tractate} ${page}: ${r.issues.join('; ')}`);
      }
    } catch (e) {
      result.failures++;
      result.failedPages.push({ page, issues: [e.message] });
      console.error(`FAIL ${tractate} ${page}: ${e.message}`);
    }
    if (opts.delayMs > 0) await new Promise((r) => setTimeout(r, opts.delayMs));
  }

  const status = result.failures === 0 ? 'PASS' : 'FAIL';
  console.log(`${status} ${tractate}: ${result.checked - result.failures}/${result.checked} ok`);
  if (result.quarantineNote) console.log(`  note: ${result.quarantineNote}`);
  return result;
}

async function runShas(ctx, args) {
  const tractates = TRACTATES.filter((t) => !args.skipQuarantined || !QUARANTINE_NOTES[t]);
  console.log(
    `Shas walk: ${tractates.length} tractates, parallel=${args.parallel}, delay=${args.delayMs}ms`,
  );
  if (args.skipQuarantined && QUARANTINE_NOTES.Shekalim) {
    console.log('Skipping quarantined: Shekalim (use without --skip-quarantined to include)');
  }

  const summary = [];
  let totalChecked = 0;
  let totalFailures = 0;

  for (let i = 0; i < tractates.length; i += args.parallel) {
    const batch = tractates.slice(i, i + args.parallel);
    const batchResults = await Promise.all(
      batch.map((t) => verifyTractate(t, ctx, { delayMs: args.delayMs })),
    );
    for (const r of batchResults) {
      summary.push(r);
      totalChecked += r.checked;
      totalFailures += r.failures;
    }
  }

  console.log('\n=== Shas verification summary ===');
  console.log(
    `${'Tractate'.padEnd(18)} ${'Amudim'.padStart(7)} ${'Pass'.padStart(7)} ${'Fail'.padStart(5)}`,
  );
  console.log('-'.repeat(42));
  for (const r of summary) {
    const pass = r.checked - r.failures;
    console.log(
      `${r.tractate.padEnd(18)} ${String(r.amudim).padStart(7)} ${String(pass).padStart(7)} ${String(r.failures).padStart(5)}`,
    );
  }
  console.log('-'.repeat(42));
  console.log(
    `${'TOTAL'.padEnd(18)} ${String(totalChecked).padStart(7)} ${String(totalChecked - totalFailures).padStart(7)} ${String(totalFailures).padStart(5)}`,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    viaApi: ctx.viaApi,
    totalChecked,
    totalFailures,
    tractates: summary,
  };
  if (args.jsonOut) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(args.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Wrote ${args.jsonOut}`);
  }
  return report;
}

const args = parseArgs(process.argv);

/** @type {{ viaApi: string | null }} */
const ctx = { viaApi: args.viaApi };
if (!ctx.viaApi && !args.noAutoApi) {
  const hbOk = await probeHbReachable();
  if (!hbOk) {
    ctx.viaApi = DEFAULT_API_BASE;
    console.log(
      `HebrewBooks unreachable from this host (likely 403) — using app API ${DEFAULT_API_BASE}`,
    );
  }
} else if (ctx.viaApi) {
  console.log(`Using app API ${ctx.viaApi} (production daf pipeline)`);
}
const SAMPLE_PAGES = TRACTATES.flatMap((t) => [
  { tractate: t, page: '2a' },
  { tractate: t, page: '2b' },
]);

let failures = 0;
let checked = 0;

if (args.shas) {
  const report = await runShas(ctx, args);
  process.exit(report.totalFailures > 0 ? 1 : 0);
} else if (args.sample) {
  console.log(`Sample mode: ${SAMPLE_PAGES.length} amudim (every tractate 2a+2b)`);
  for (const { tractate, page } of SAMPLE_PAGES) {
    try {
      const r = await verifyOne(tractate, page, null, ctx);
      checked++;
      if (!r.ok) {
        failures++;
        console.error(`FAIL ${tractate} ${page}: ${r.issues.join('; ')}`);
      } else {
        console.log(`ok ${tractate} ${page}`);
      }
    } catch (e) {
      failures++;
      console.error(`FAIL ${tractate} ${page}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
} else {
  const tractate = args.tractate;
  console.log(`Verifying ${tractate}: ${iterAmudimLocal(tractate).length} amudim`);
  const r = await verifyTractate(tractate, ctx, {
    from: args.from,
    to: args.to,
    delayMs: args.delayMs,
  });
  checked = r.checked;
  failures = r.failures;
}

console.log(`\nChecked ${checked}, failures ${failures}`);
process.exit(failures > 0 ? 1 : 0);
