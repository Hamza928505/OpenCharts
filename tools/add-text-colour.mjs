/**
 * add-text-colour.mjs — give every self-drawn chart a text-colour control.
 *
 * The canvas charts painted their labels with a hardcoded `rgba(128,128,128,α)`
 * — thirty-odd charts, fifty-odd call sites, and no way for a reader to change
 * any of it. This rewrote them to draw through `ink(α)`, which reads the
 * colour from the spec and falls back to exactly the old grey.
 *
 *   node tools/add-text-colour.mjs           report what it would change
 *   node tools/add-text-colour.mjs --write   change it
 *
 * Kept for provenance. Run it again only if a new chart is written the old way;
 * it is idempotent, and skips any chart that already has a text colour.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const DIR = 'js/studio/charts';
const write = process.argv.includes('--write');

/** The alphas that are text. `.10` and `.14` are band fills, and stay. */
const TEXT_ALPHA = /ctx\.fillStyle = 'rgba\(128,128,128,\.(6|7|75|8|85|9|95)\)'/g;

/** Serialised into exports, so it must not reference anything outside itself. */
const INK_HELPER = `/**
 * Chart text at a given opacity, in whatever colour the spec asks for.
 *
 * Defaults to the neutral grey these charts have always used, so a spec that
 * says nothing looks exactly as it did.
 */
function inkColor(color, alpha) {
  if (!color) return 'rgba(128,128,128,' + alpha + ')';
  const hex = String(color).replace('#', '');
  const full = hex.length === 3 ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return 'rgba(128,128,128,' + alpha + ')';
  }
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}`;

const CONTROL = "      { group: 'Labels', type: 'color',  key: 'opts.textColor', label: 'Text colour' },";

let touchedCharts = 0;
let touchedCalls = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.js') && f !== '_data.js')) {
  const path = `${DIR}/${file}`;
  const raw = readFileSync(path, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  let lines = raw.split(/\r?\n/);

  // Chart blocks, so each edit lands inside the right definition.
  const starts = [];
  lines.forEach((l, i) => {
    const m = l.match(/^    id: '([a-z0-9-]+)',$/);
    if (m) starts.push({ id: m[1], line: i });
  });
  if (!starts.length) continue;

  let fileTouched = false;

  // Back to front, so earlier indices stay valid as lines are inserted.
  for (let k = starts.length - 1; k >= 0; k--) {
    const from = starts[k].line;
    const to = k + 1 < starts.length ? starts[k + 1].line : lines.length;
    const block = lines.slice(from, to);
    const body = block.join('\n');

    if (!TEXT_ALPHA.test(body)) { TEXT_ALPHA.lastIndex = 0; continue; }
    TEXT_ALPHA.lastIndex = 0;
    if (body.includes('opts.textColor')) continue;   // already done

    const calls = (body.match(TEXT_ALPHA) || []).length;
    TEXT_ALPHA.lastIndex = 0;

    let next = body.replace(TEXT_ALPHA, (_m, a) => `ctx.fillStyle = ink(0.${a})`);

    // The draw needs `env` and an `ink` bound to this spec.
    next = next.replace(/      draw\(ctx, spec, W, H\) \{\n/, '      draw(ctx, spec, W, H, env) {\n');
    next = next.replace(
      /(      draw\(ctx, spec, W, H, env\) \{\n)/,
      `$1        const ink = (a) => inkColor(spec.opts.textColor, a);\n`,
    );

    // Declare the helper, or the exported chart throws a ReferenceError.
    if (/\n      helpers: \[/.test(next)) {
      next = next.replace(/\n      helpers: \[([^\]]*)\]/, (m2, inner) =>
        (inner.includes('inkColor') ? m2
          : `\n      helpers: [${inner.trim() ? inner + ', ' : ''}inkColor]`));
    } else {
      next = next.replace(/(\n    canvas: \{\n)/, `$1      helpers: [inkColor],\n`);
    }

    // A default that reproduces the grey, and a control to change it.
    next = next.replace(/(\n      opts: \{ )/, `$1textColor: '#808080', `);
    if (!/textColor: '#808080'/.test(next)) {
      // Multi-line opts object.
      next = next.replace(/(\n      opts: \{\n)/, `$1        textColor: '#808080',\n`);
    }
    next = next.replace(/(\n    controls: \[\n)/, `$1${CONTROL}\n`);

    lines.splice(from, to - from, ...next.split('\n'));
    fileTouched = true;
    touchedCharts++;
    touchedCalls += calls;
    console.log(`  ${starts[k].id.padEnd(24)} ${calls} text call${calls === 1 ? '' : 's'}`);
  }

  if (!fileTouched) continue;

  let out = lines.join('\n');
  if (!out.includes('function inkColor(')) {
    // Above the first export, next to the file's other serialised helpers.
    out = out.replace(/\nexport const /, `\n${INK_HELPER}\n\nexport const `);
  }
  if (write) writeFileSync(path, out.split('\n').join(nl));
}

console.log(`\n${touchedCharts} charts, ${touchedCalls} text call sites${write ? ' — written' : ' (dry run)'}`);
