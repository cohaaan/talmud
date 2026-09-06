import { Show, type JSX } from 'solid-js';
import type { Amud } from '../lib/daf-render/core/types';
import { formatPerekHeaderLine, type PerekHeader } from '../lib/sefref/perek';
import { pageLabelHe, tractateLabelHe } from '../lib/sefref/tractates';

export interface DafPageFrameProps {
  tractate: string;
  page: string;
  amud: Amud;
  /** Sefaria-derived running perek title; omit when unknown. */
  perekHeader?: PerekHeader | null;
  children: JSX.Element;
}

/**
 * Printed Vilna Shas page silhouette: warm paper, double rule, running
 * tractate + perek header, and a marginal Hebrew folio mark.
 */
export function DafPageFrame(props: DafPageFrameProps): JSX.Element {
  const folio = () => pageLabelHe(props.page);
  const tractateHe = () => tractateLabelHe(props.tractate);
  const amudLabel = () => (props.amud === 'a' ? 'ע״א' : 'ע״ב');
  const perekLine = () => {
    const h = props.perekHeader;
    return h ? formatPerekHeaderLine(h) : null;
  };

  return (
    <section class="daf-page-frame" dir="rtl" lang="he" aria-label={`${tractateHe()} ${folio()}`}>
      <div class="daf-page-frame__rule daf-page-frame__rule--top" aria-hidden="true" />
      <header class="daf-page-frame__header">
        <span class="daf-page-frame__tractate">{tractateHe()}</span>
        <Show when={perekLine()}>
          {(line) => <span class="daf-page-frame__perek">{line()}</span>}
        </Show>
        <span class="daf-page-frame__amud">{amudLabel()}</span>
      </header>
      <div class="daf-page-frame__body">
        <aside class="daf-page-frame__folio" aria-hidden="true">
          <span class="daf-page-frame__folio-num">{folio()}</span>
        </aside>
        <div class="daf-page-frame__content">{props.children}</div>
      </div>
      <div class="daf-page-frame__rule daf-page-frame__rule--bottom" aria-hidden="true" />
    </section>
  );
}
