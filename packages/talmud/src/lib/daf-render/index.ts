export type { DafGeometry, LayoutResult } from './core/layout';
export { computeGeometry, computeLayout } from './core/layout';
export type { DafOptions, PartialDafOptions } from './core/options';
export { defaultOptions, resolveOptions } from './core/options';
export type { Amud, ColumnGeometry, DafTexts, LayoutCase, SpacerHeights } from './core/types';
export {
  VILNA_FRAME_WIDTH,
  VILNA_MAIN_WIDTH,
  VILNA_TEXT_WIDTH,
} from './layout-constants';
export type { DafRendererProps } from './solid/DafRenderer';
export { DafRenderer } from './solid/DafRenderer';
