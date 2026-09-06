import { parsePageRef } from '../lib/daf-identity/page-ref';
import type { TalmudPageData } from '../lib/sefref';
import { ensureMasechetIncipit } from './ensureMasechetIncipit';
import { injectHadran } from './injectHadran';
import { tokenizeHebrewHtml } from './tokenize';

/** Lightweight tokenization for spread-view preview panes (no marks/gutters). */
export function tokenizeDafPreview(
  d: TalmudPageData,
  pageStr: string,
): { main: string; inner: string; outer: string } {
  const wrapPieces = (
    pieces: string[] | undefined,
    pieceKeys: string[] | undefined,
    joined: string,
    comm: 'rashi' | 'tosafot',
  ): string => {
    if (!pieces || pieces.length === 0) return tokenizeHebrewHtml(joined);
    return pieces
      .map((p, i) => {
        const key = pieceKeys?.[i];
        const keyAttr = key ? ` data-piece-key="${key}"` : '';
        return `<span class="daf-comm-piece" data-comm="${comm}"${keyAttr}>${tokenizeHebrewHtml(p)}</span>`;
      })
      .join(' ');
  };

  let main = tokenizeHebrewHtml(d.mainText.hebrew);
  let inner = d.rashi ? wrapPieces(d.rashi.pieces, d.rashi.pieceKeys, d.rashi.hebrew, 'rashi') : '';
  let outer = d.tosafot
    ? wrapPieces(d.tosafot.pieces, d.tosafot.pieceKeys, d.tosafot.hebrew, 'tosafot')
    : '';

  const parsed = parsePageRef(pageStr);
  if (parsed && parsed.daf === 2 && parsed.amud === 'a') {
    main = ensureMasechetIncipit(main);
  }

  main = injectHadran(main);
  if (inner) inner = injectHadran(inner);
  if (outer) outer = injectHadran(outer);

  return { main, inner, outer };
}
