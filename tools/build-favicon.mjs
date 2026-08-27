/**
 * build-favicon.mjs — write the site icons from the nav-bar brand mark.
 *
 * The mark is defined once, here, in the same terms `css/studio.css` states it
 * in: a 32px rounded tile carrying `linear-gradient(140deg, --a-purple,
 * --a-blue)` with the white polyline from the `.brand-mark` SVG on top. Both
 * outputs are generated from that one description, so the tab icon cannot
 * drift away from the logo the header shows.
 *
 * Two deliberate departures from the header, both for legibility at 16px:
 * the glyph fills 62.5% of the tile rather than 53%, and its stroke is a
 * little heavier. At a favicon's real size the header's proportions come out
 * as a hairline nobody can read.
 *
 *   node tools/build-favicon.mjs
 *
 * Writes favicon.svg, favicon-32.png and apple-touch-icon.png. The SVG is what
 * every current browser uses; the PNGs are the fallback for the ones that do
 * not take an SVG icon, and the home-screen icon iOS asks for by name.
 *
 * PNG is written by hand rather than by a dependency: it is a CRC, a zlib
 * stream and a 25-byte header, and adding an image library to a project whose
 * whole claim is "no build step" to draw four line segments would be absurd.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* ── the mark ────────────────────────────────────────────────────────────── */

const SIZE = 32;              // design space, matching .brand-mark's 32px box
const RADIUS = 9;             // .brand-mark border-radius
const PURPLE = [0x6c, 0x63, 0xd8];   // --a-purple
const BLUE = [0x2f, 0x76, 0xc9];     // --a-blue

// linear-gradient(140deg, …): CSS angles run clockwise from "to top", so the
// gradient line points right and down.
const ANGLE = 140 * (Math.PI / 180);
const DIR = { x: Math.sin(ANGLE), y: -Math.cos(ANGLE) };

// The .brand-mark path, on its own 16-unit viewBox.
const GLYPH = [[1.6, 12.4], [5.2, 8.2], [8.0, 10.8], [14.4, 3.6]];
const GLYPH_SPAN = 20;                        // of 32 — see the note above
const SCALE = GLYPH_SPAN / 16;
const OFFSET = (SIZE - GLYPH_SPAN) / 2;
const STROKE = 2.4;                           // in design units

const points = GLYPH.map(([x, y]) => [OFFSET + x * SCALE, OFFSET + y * SCALE]);

/* ── geometry ────────────────────────────────────────────────────────────── */

/** Signed distance from a point to a rounded rectangle, negative inside. */
function tileDistance(x, y) {
  const dx = Math.abs(x - SIZE / 2) - (SIZE / 2 - RADIUS);
  const dy = Math.abs(y - SIZE / 2) - (SIZE / 2 - RADIUS);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - RADIUS;
}

/** Distance from a point to the polyline — round caps and joins come free. */
function glyphDistance(x, y) {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2)) : 0;
    best = Math.min(best, Math.hypot(x - (ax + t * vx), y - (ay + t * vy)));
  }
  return best;
}

function gradientAt(x, y) {
  const t = Math.max(0, Math.min(1, (DIR.x * (x / SIZE) + DIR.y * (y / SIZE))));
  return PURPLE.map((c, i) => Math.round(c + (BLUE[i] - c) * t));
}

/* ── raster ──────────────────────────────────────────────────────────────── */

/** Render the mark at `px` square, supersampled so the corners are not steps. */
function render(px, samples = 4) {
  const out = new Uint8Array(px * px * 4);
  const step = SIZE / (px * samples);
  const half = step / 2;

  for (let py = 0; py < px; py++) {
    for (let pxi = 0; pxi < px; pxi++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (pxi * samples + sx) * step + half;
          const y = (py * samples + sy) * step + half;
          if (tileDistance(x, y) > 0) continue;            // outside the tile
          const [tr, tg, tb] = glyphDistance(x, y) <= STROKE / 2
            ? [255, 255, 255]
            : gradientAt(x, y);
          r += tr; g += tg; b += tb; a += 255;
        }
      }
      const n = samples * samples;
      const i = (py * px + pxi) * 4;
      // Straight (unpremultiplied) alpha: colour is the average of the samples
      // that landed on the tile, not of all of them, or the edge goes dark.
      const lit = a / 255 || 1;
      out[i] = Math.round(r / lit);
      out[i + 1] = Math.round(g / lit);
      out[i + 2] = Math.round(b / lit);
      out[i + 3] = Math.round(a / n);
    }
  }
  return out;
}

/* ── PNG ─────────────────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPNG(px, rgba) {
  const stride = px * 4;
  const raw = Buffer.alloc((stride + 1) * px);
  for (let y = 0; y < px; y++) {
    raw[y * (stride + 1)] = 0;                              // filter: none
    Buffer.from(rgba.subarray(y * stride, (y + 1) * stride)).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8;                                              // 8 bits per channel
  ihdr[9] = 6;                                              // truecolour + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ── SVG ─────────────────────────────────────────────────────────────────── */

const round = (n) => Number(n.toFixed(2));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  <!-- Generated by tools/build-favicon.mjs from the .brand-mark in the header. -->
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="${round(DIR.x)}" y2="${round(DIR.y)}">
      <stop offset="0" stop-color="#6C63D8"/>
      <stop offset="1" stop-color="#2F76C9"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="url(#g)"/>
  <path d="M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}"
        fill="none" stroke="#fff" stroke-width="${STROKE}"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

/* ── write ───────────────────────────────────────────────────────────────── */

const files = [
  ['favicon.svg', Buffer.from(svg, 'utf8')],
  ['favicon-32.png', toPNG(32, render(32))],
  ['apple-touch-icon.png', toPNG(180, render(180, 3))],
];

for (const [name, buf] of files) {
  writeFileSync(join(ROOT, name), buf);
  console.log(`${name.padEnd(22)} ${String(buf.length).padStart(6)} bytes`);
}
