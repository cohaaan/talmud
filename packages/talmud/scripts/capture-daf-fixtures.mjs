#!/usr/bin/env node
/**
 * Capture daf JSON fixtures from a running app (default: production).
 *
 * Usage:
 *   node scripts/capture-daf-fixtures.mjs --tractate "Bava Metzia" --pages 2a,2b,59a,60a,119a
 *   node scripts/capture-daf-fixtures.mjs --tractate "Bava Metzia" --pages 2a --out src/fixtures/bava-metzia-2a-hb.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_API = 'https://talmud.dev';

function slugify(tractate, page) {
  return `${tractate.toLowerCase().replace(/\s+/g, '-')}-${page}`;
}

function parseArgs(argv) {
  const out = { tractate: 'Bava Metzia', pages: [], api: DEFAULT_API, outDir: join(__dirname, '../src/fixtures') };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--tractate') out.tractate = argv[++i];
    else if (argv[i] === '--pages') out.pages = argv[++i].split(',').map((p) => p.trim());
    else if (argv[i] === '--via-api') out.api = argv[++i];
    else if (argv[i] === '--out-dir') out.outDir = argv[++i];
    else if (argv[i] === '--out') out.singleOut = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv);
if (!args.pages.length) {
  console.error('Provide --pages 2a,2b,...');
  process.exit(1);
}

mkdirSync(args.outDir, { recursive: true });

for (const page of args.pages) {
  const url = `${args.api.replace(/\/$/, '')}/api/daf/${encodeURIComponent(args.tractate)}/${page}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAIL ${page}: HTTP ${res.status}`);
    process.exit(1);
  }
  const j = await res.json();
  const fixture = {
    mainText: { hebrew: j.mainText?.hebrew ?? '', english: j.mainText?.english ?? '' },
    rashi: j.rashi ? { hebrew: j.rashi.hebrew ?? '', english: j.rashi.english ?? '' } : undefined,
    tosafot: j.tosafot
      ? { hebrew: j.tosafot.hebrew ?? '', english: j.tosafot.english ?? '' }
      : undefined,
    _source: j._source,
    mainSegmentsHe: j.mainSegmentsHe ?? [],
  };
  const name = args.singleOut && args.pages.length === 1 ? args.singleOut : join(args.outDir, `${slugify(args.tractate, page)}.json`);
  writeFileSync(name, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`wrote ${name} (${fixture._source}, main ${fixture.mainText.hebrew.length} chars)`);
}
