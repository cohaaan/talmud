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
 *   node scripts/verify-daf-identity.mjs --tractate "Bava Metzia" --via-api https://talmud.dev
 *
 * When HebrewBooks returns 403 (common on cloud VMs), the script auto-falls back
 * to https://talmud.dev unless --no-auto-api is set.
 *
 * Exit 1 on any error-level mismatch.
 */

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
  if (n1.length === 1 && n2.startsWith(n1)) return true;
  if (n2.length === 1 && n1.startsWith(n2)) return true;
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

function subsequenceOpensWith(hbRaw, segRaw, minWords = 2) {
  const hb = skipStructural(hbRaw);
  const seg = skipStructural(segRaw);
  if (!hb.length || !seg.length) return false;

  let hi = 0;
  let matched = 0;
  for (let sj = 0; sj < seg.length && hi < hb.length; sj++) {
    if (wordsMatchFuzzy(hb[hi], seg[sj])) {
      matched++;
      hi++;
      if (matched >= minWords) return true;
    }
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
    const res = await fetch(
      'https://hebrewbooks.org/shas.aspx?mesechta=1&daf=2&format=text',
      {
        headers: { 'User-Agent': 'talmud-verify-daf-identity/1.0' },
        signal: AbortSignal.timeout(10000),
      },
    );
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
  for (let i = 0; i < Math.min(4, segments.length); i++) {
    out.push(segments[i]);
    const w0 = words(segments[i]);
    // Sefaria sometimes splits a sentence across segment boundaries (e.g. "מיקל," | "אמר אביי").
    if (i + 1 < segments.length && w0.length <= 2) {
      out.push(`${segments[i]} ${segments[i + 1]}`);
    }
  }
  return out;
}

function opensWithSegments(main, segments, minWords = 2) {
  if (!segments.length) return false;
  for (const candidate of segmentCandidates(segments)) {
    if (subsequenceOpensWith(words(main), words(candidate), minWords)) return true;
  }
  return false;
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

  if (!main || words(main).length < 12) {
    issues.push('empty or truncated main column');
  }
  if (main && rashi && fp(main, 20) === fp(rashi, 20)) {
    issues.push('main equals rashi');
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
    from: null,
    to: null,
    viaApi: null,
    noAutoApi: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--tractate') out.tractate = argv[++i];
    else if (argv[i] === '--sample') out.sample = true;
    else if (argv[i] === '--from') out.from = argv[++i];
    else if (argv[i] === '--to') out.to = argv[++i];
    else if (argv[i] === '--via-api') out.viaApi = argv[++i];
    else if (argv[i] === '--no-auto-api') out.noAutoApi = true;
  }
  return out;
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

if (args.sample) {
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
  let pages = [...iterAmudimLocal(tractate)];
  if (args.from) {
    const fromN = amudToNumber(normalizePageRef(args.from));
    const toN = amudToNumber(normalizePageRef(args.to ?? pages.at(-1)));
    pages = pages.filter((p) => {
      const n = amudToNumber(p);
      return n >= fromN && n <= toN;
    });
  }
  console.log(`Verifying ${tractate}: ${pages.length} amudim`);
  let prevFp = null;
  for (const page of pages) {
    try {
      const r = await verifyOne(tractate, page, prevFp, ctx);
      checked++;
      prevFp = r.mainFp;
      if (!r.ok) {
        failures++;
        console.error(`FAIL ${tractate} ${page}: ${r.issues.join('; ')}`);
      } else if (checked % 20 === 0) {
        console.log(`… ${checked}/${pages.length}`);
      }
    } catch (e) {
      failures++;
      console.error(`FAIL ${tractate} ${page}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

console.log(`\nChecked ${checked}, failures ${failures}`);
process.exit(failures > 0 ? 1 : 0);
