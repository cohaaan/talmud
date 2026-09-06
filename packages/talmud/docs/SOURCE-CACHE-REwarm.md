# Source KV cache — gdropcap sanitize & rewarm

HebrewBooks HTML occasionally prefixes the main column with a broken drop-cap marker (`[א]` or `א]`) instead of a proper `.gdropcap` span. That glitch is stripped by `sanitizeHebrewBooksColumn()` in `packages/talmud/src/lib/sefref/hebrewbooks/client.ts`.

## Runtime behavior

| Path | Behavior |
|------|----------|
| **Fetch** | Sanitize before write (`getHebrewBooksDafCached` miss path) |
| **KV read** | Sanitize on every hit (`applyHbSanitize`) — legacy `hb:v2:` keys are orphaned after the v3 bump; cold-miss refetches write sanitized v3 entries |
| **New keys** | `hb:v3:{tractate}:{page}` — cold miss refetches upstream and writes sanitized HTML |

Sanitize-on-read protects any v3 entry written before sanitize landed on the write path. The v2→v3 key bump cold-misses once per amud (refetch upstream, write sanitized HTML under `hb:v3:`).

## When to rewarm

Full Shas rewarm is **not required** for gdropcap fix alone. Optional rewarm scenarios:

1. **Force fresh upstream HTML** — e.g. HebrewBooks corrected their source; bump `hb:v4` in `keyForHebrewBooks` and run warm-cron / `warm-shas-sample.mjs`.
2. **Perek headers** — `sefaria-seg:v2` includes chapter `alts`; old `sefaria-seg:v1` entries cold-miss on next read. Perek **names** also cache under `perek-name:v1:{tractate}:{perekNum}` as dapim are visited.
3. **Admin enrichment rewarm** — `POST /api/admin/rewarm/:id/:t/:p` evicts **producer artifacts only**, not HB/Sefaria source KV.

## Ops commands

```bash
# Sample warm (from repo root, worker must be reachable)
pnpm --filter talmud exec node scripts/warm-shas-sample.mjs

# Cache stats dashboard (counts hb:v2 + hb:v3)
curl -s https://talmud.dev/api/admin/cache-stats | jq '.sources.hebrewBooks'
```

## Key helpers

All source keys live in `packages/talmud/src/worker/cache-keys.ts`. Version bumps must update:

- `source-cache.ts` reader
- `warm-cron.ts` warm probes
- `cache-stats.ts` prefix counts
- `tests/source-cache-keys.test.ts` byte-exact contract
