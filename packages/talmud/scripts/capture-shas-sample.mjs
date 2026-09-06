#!/usr/bin/env node
/**
 * Capture start/mid/end HB fixtures for a cross-Shas identity sample.
 * Usage: node scripts/capture-shas-sample.mjs [--via-api https://talmud.dev]
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../src/fixtures/shas-sample');
const DEFAULT_API = 'https://talmud.dev';

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

const SAMPLE_TRACTATES = [
  'Berakhot',
  'Shabbat',
  'Pesachim',
  'Yoma',
  'Yevamot',
  'Bava Metzia',
  'Sanhedrin',
  'Chullin',
  'Gittin',
  'Niddah',
];

function amudToNumber(amud) {
  const m = amud.match(/^(\d+)([ab])$/);
  return parseInt(m[1], 10) * 2 + (m[2] === 'a' ? -1 : 0);
}

function numberToAmud(n) {
  const daf = Math.ceil(n / 2);
  return `${daf}${n % 2 === 1 ? 'a' : 'b'}`;
}

function samplePages(tractate) {
  const end = END_AMUD[tractate.toLowerCase()];
  const startN = amudToNumber('2a');
  const endN = amudToNumber(end);
  const midN = Math.floor((startN + endN) / 2);
  return ['2a', numberToAmud(midN), end];
}

function slug(t, p) {
  return `${t.toLowerCase().replace(/\s+/g, '-')}-${p}`;
}

const api = (process.argv.includes('--via-api')
  ? process.argv[process.argv.indexOf('--via-api') + 1]
  : DEFAULT_API
).replace(/\/$/, '');

mkdirSync(OUT_DIR, { recursive: true });
const manifest = [];

for (const tractate of SAMPLE_TRACTATES) {
  for (const page of samplePages(tractate)) {
    const url = `${api}/api/daf/${encodeURIComponent(tractate)}/${page}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`FAIL ${tractate} ${page}: HTTP ${res.status}`);
      process.exit(1);
    }
    const j = await res.json();
    const fixture = {
      tractate,
      page,
      mainText: { hebrew: j.mainText?.hebrew ?? '', english: '' },
      rashi: j.rashi ? { hebrew: j.rashi.hebrew ?? '', english: '' } : undefined,
      tosafot: j.tosafot ? { hebrew: j.tosafot.hebrew ?? '', english: '' } : undefined,
      _source: j._source,
      mainSegmentsHe: j.mainSegmentsHe ?? [],
    };
    const id = slug(tractate, page);
    const path = join(OUT_DIR, `${id}.json`);
    writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
    manifest.push({ id, tractate, page, path: `shas-sample/${id}.json`, source: fixture._source });
    console.log(`ok ${tractate} ${page}`);
    await new Promise((r) => setTimeout(r, 80));
  }
}

writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Captured ${manifest.length} fixtures → ${OUT_DIR}`);
