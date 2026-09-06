import type { JSX } from 'solid-js';
import type { Amud } from '../lib/daf-render/core/types';
import { pageLabelHe, tractateLabelHe } from '../lib/sefref/tractates';

export interface DafPageFrameProps {
  tractate: string;
  page: string;
  amud: Amud;
  children: JSX.Element;
}

/**
 * Printed Vilna Shas page silhouette: warm paper, double rule, running
 * tractate header, and a marginal Hebrew folio mark. Study overlays (gutter
 * icons, highlights) render inside the frame on top of the daf surface.
 *
 * TODO(perek-header): HB text exposes gdropcap/ghadran but not centered פרק
 * titles; needs Sefaria chapter index or open perek→daf map before rendering.
 */
export function DafPageFrame(props: DafPageFrameProps): JSX.Element {
  const folio = () => pageLabelHe(props.page);
  const tractateHe = () => tractateLabelHe(props.tractate);
  const amudLabel = () => (props.amud === 'a' ? 'ע״א' : 'ע״ב');

  return (
    <section class="daf-page-frame" dir="rtl" lang="he" aria-label={`${tractateHe()} ${folio()}`}>
      <div class="daf-page-frame__rule daf-page-frame__rule--top" aria-hidden="true" />
      <header class="daf-page-frame__header">
        <span class="daf-page-frame__tractate">{tractateHe()}</span>
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
