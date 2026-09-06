import { render } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { DafPageFrame } from '../../src/client/DafPageFrame';

describe('DafPageFrame', () => {
  it('renders tractate header and Hebrew folio mark', () => {
    const { container } = render(() => (
      <DafPageFrame tractate="Berakhot" page="2a" amud="a">
        <div class="daf-root">text</div>
      </DafPageFrame>
    ));
    expect(container.querySelector('.daf-page-frame__tractate')?.textContent).toBe('ברכות');
    expect(container.querySelector('.daf-page-frame__folio-num')?.textContent).toBe('ב.');
    expect(container.querySelector('.daf-page-frame__amud')?.textContent).toBe('ע״א');
    expect(container.querySelector('.daf-root')).toBeTruthy();
    expect(container.querySelector('.daf-page-frame__perek')).toBeNull();
  });

  it('renders running perek header when provided', () => {
    const { container } = render(() => (
      <DafPageFrame
        tractate="Bava Metzia"
        page="60b"
        amud="b"
        perekHeader={{ perekNum: 5, nameHe: 'איזהו נשך' }}
      >
        <div class="daf-root">text</div>
      </DafPageFrame>
    ));
    expect(container.querySelector('.daf-page-frame__perek')?.textContent).toBe('פרק איזהו נשך');
  });
});
