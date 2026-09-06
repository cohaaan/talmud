/** Width of the Tzurat HaDaf text block (px). Sized to approximate a Vilna
 *  folio text area at comfortable screen DPI — wider than the old 520px cap
 *  so side columns breathe like print, still scaled on narrow phones. */
export const VILNA_TEXT_WIDTH = 560;

/** Total framed page width including folio margin rails (px). */
export const VILNA_FRAME_WIDTH = VILNA_TEXT_WIDTH + 48;

/** Center Gemara column as a fraction of content width (classic ~46–48%). */
export const VILNA_MAIN_WIDTH = 0.47;
