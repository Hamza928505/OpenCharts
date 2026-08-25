/**
 * palette.js — the one colour source for the whole studio.
 *
 * Every chart definition draws its default colours from PALETTE so a single
 * edit re-themes the entire library. The named keys mirror the legacy
 * `js/utils.js` `U.C` object so ported charts read the same as before.
 */

export const PALETTE = [
  '#6C63D8', // purple
  '#16916A', // teal
  '#CE5229', // coral
  '#2F76C9', // blue
  '#A5720F', // amber
  '#C13F69', // pink
  '#5A6270', // slate
  '#7A9A2E', // olive
];

export const C = {
  purple: PALETTE[0],
  teal:   PALETTE[1],
  coral:  PALETTE[2],
  blue:   PALETTE[3],
  amber:  PALETTE[4],
  pink:   PALETTE[5],
  gray:   PALETTE[6],
  olive:  PALETTE[7],
  red:    '#CE3B3B',
};

/** Swatch options offered by every colour picker in the control panel. */
export const SWATCHES = [
  ...PALETTE,
  '#D64545', '#0E7C86', '#8E44AD', '#2D6A4F',
  '#B5651D', '#37474F', '#00838F', '#AD1457',
];

/**
 * Append an alpha channel to a 6-digit hex colour.
 * Returns the input untouched if it is not a plain #rrggbb value, so rgba()
 * strings and CSS variables pass through unharmed.
 *
 * @param {string} hex   e.g. '#6C63D8'
 * @param {number} alpha 0–1
 */
export function withAlpha(hex, alpha) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + a;
}

/** Lighten (amount > 0) or darken (amount < 0) a hex colour by a ratio. */
export function shade(hex, amount) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const next = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
    return Math.round(Math.max(0, Math.min(255, next)));
  });
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Pick black or white text for legibility on the given background. */
export function contrastInk(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Rec. 709 relative luminance
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 150 ? '#111111' : '#ffffff';
}

/** Cycle the palette so any series index always resolves to a colour. */
export const paletteAt = (i) => PALETTE[i % PALETTE.length];

/* Shared label vocabularies used by several chart definitions. */
export const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTHS6  = MONTHS.slice(0, 6);
export const QUARTERS = ['Q1','Q2','Q3','Q4'];
export const DAYS     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
