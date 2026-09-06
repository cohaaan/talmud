# Vilna margin apparatus — Ein Mishpat / Mesorat HaShas

Printed Vilna Shas places **Ein Mishpat** and **Mesorat HaShas** reference numbers in the outer margins of each folio (small numerals pointing to Shulchan Aruch / Tur / parallel sugyot). This app renders the **gemara text and commentary columns** from HebrewBooks scans plus Sefaria alignment; it does **not** yet reproduce those margin numerals.

## What open data provides today

| Source | Available | Not available |
|--------|-----------|---------------|
| **Sefaria** halacha links (`/api/links/...`) | `einMishpat` boolean on classical codification links; target refs (e.g. Shulchan Aruch) | Vilna **margin slot numbers** (the printed index on the folio) |
| **Sefaria** Talmud parallels | Mesorat HaShas cross-refs to parallel sugyot (`category: "Talmud"`) | Per-segment **margin indices** matching the printed edition |
| **HebrewBooks** scan | Pixel-accurate main/Rashi/Tosafot HTML | Margin apparatus is outside the scanned column HTML we ingest |

The worker already surfaces Sefaria's semantic data:

- `einMishpat` on halacha-ref snippets and codifier chains (`halacha-refs:v3`, sidebar halacha cards).
- Mesorat HaShas parallels via `talmud-parallels:v1` and the Yerushalmi / parallel sidebar.

These are **content links**, not **layout coordinates** for margin numbers.

## Blocker for print-fidelity margin numbers

Reproducing Vilna margin numerals requires a licensed mapping from **(tractate, daf, amud, word/segment position) → {ein mishpat index, mesorat hashas index}**. No such mapping exists in:

- Sefaria API responses we use (v3 texts, links, related)
- HebrewBooks HTML (`shastext` fieldsets)
- Our KV caches

Fabricating numbers from link order or segment index would misrepresent the printed edition and violate the project's precision-over-recall bar for layout.

## TODO (when a source appears)

1. Ingest a **Vilna margin index** dataset (explicit license / public domain) keyed to the same daf identity contract as `verify-daf-identity`.
2. Anchor entries to **Sefaria segment indices** (or HB word ranges) via the existing alignment pipeline.
3. Render margin numerals in `DafPageFrame` rails — separate from gutter study-aid icons.
4. Characterization tests on a fixed daf sample comparing rendered indices to the printed PDF.

## Related code

- Halacha Ein Mishpat flag: `packages/talmud/src/lib/halacha/codifiers.ts`
- Mesorat parallels: `packages/talmud/src/lib/context/parallels.ts`, `getTalmudParallelsCached`
- Page frame (future margin rail): `packages/talmud/src/client/DafPageFrame.tsx`
