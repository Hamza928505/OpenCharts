/**
 * palette-ui.js — the two pieces of furniture that edit a chart's colours.
 *
 * `colourWarning` was born inside `ControlPanel.js`, where two widgets needed
 * it. The Colours tab in the code panel is the third caller, and a third copy
 * of a statement about the palette would be a third thing to keep true — so it
 * lives here, with the editor that grew beside it.
 *
 * Neither of these knows where a chart keeps its colours. `paletteOf` answers
 * that once, for both, and its `set(i, hex)` writes back to whichever array a
 * colour came from.
 */

import { confusablePairs, describePairs, simulate, CVD_KINDS, paletteOf } from './cvd.js';
import { attachColourPicker } from './colorpicker.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * The colour-vision warning and its simulate toggle.
 *
 * `read()` hands back the colours whenever they are asked for rather than a
 * snapshot, because every caller repaints on edit and a captured list would go
 * stale on the first colour change.
 *
 * @param {() => string[]} read
 * @param {(i: number) => string} nameAt   what to call colour i
 * @param {() => void} repaint             redraw the swatches in the new mode
 */
export function colourWarning(read, nameAt, repaint) {
  const warn = el('p', 'palette-warn');
  const sim = el('button', 'palette-sim');
  sim.type = 'button';
  let showing = '';

  function paint() {
    // Only the colours this chart actually uses. Checking the whole eight-colour
    // palette would report pairs no reader will ever see side by side.
    const pairs = confusablePairs(read());
    warn.textContent = describePairs(pairs, nameAt);
    warn.hidden = !pairs.length;
    sim.hidden = !pairs.length && !showing;
    sim.textContent = showing
      ? 'Back to normal vision'
      : `See it as a ${(CVD_KINDS.find((k) => k.key === (pairs[0] || {}).kind) || CVD_KINDS[0]).label} reader`;
    sim.dataset.kind = showing || (pairs[0] || {}).kind || CVD_KINDS[0].key;
  }

  sim.addEventListener('click', () => {
    showing = showing ? '' : (sim.dataset.kind || CVD_KINDS[0].key);
    repaint();
  });

  return { warn, sim, paint, showing: () => showing };
}

/**
 * The whole palette in one place: a swatch, a name and a hex per series.
 *
 * The sidebar edits a colour one row at a time, next to that series' name and
 * values; the data table edits it against the column or row it belongs to.
 * Neither shows the palette *as a set*, which is the thing you need when the
 * question is "do these twelve work together" rather than "what colour is
 * this one".
 *
 * Rebuilt rather than updated in place: an edit can change how many series
 * there are, and a stale row would write to an index that has gone — the same
 * rule the control panel and the grid both follow.
 *
 * @param {object} def
 * @param {object} spec   mutated in place, like every other control
 * @param {Function} onChange  called after a colour is picked
 */
export function paletteEditor(def, spec, onChange) {
  const host = el('div', 'palette-editor');

  function paint() {
    host.innerHTML = '';
    const palette = paletteOf(def, spec);

    if (!palette.colors.length) {
      host.appendChild(el('p', 'palette-editor-empty',
        'This chart draws in a single colour, so there is no palette to set.'));
      return;
    }

    const cvd = colourWarning(
      () => paletteOf(def, spec).colors,
      (i) => paletteOf(def, spec).names[i] || '',
      () => paint(),
    );

    const list = el('div', 'palette-editor-list');
    palette.colors.forEach((hex, i) => {
      const row = el('div', 'palette-editor-row');

      const dot = el('button', 'palette-editor-dot');
      dot.type = 'button';
      // Simulated while previewing, but the picker still edits the real
      // colour: this is inspection, never an edit.
      dot.style.background = cvd.showing() ? simulate(hex, cvd.showing()) : hex;
      dot.setAttribute('aria-label', `Colour ${i + 1}${palette.names[i] ? `, ${palette.names[i]}` : ''}`);
      attachColourPicker(dot, () => paletteOf(def, spec).colors[i] || hex, (next) => {
        paletteOf(def, spec).set(i, next);
        paint();
        onChange();
      });

      const name = el('span', 'palette-editor-name', palette.names[i] || `Series ${i + 1}`);
      const code = el('span', 'palette-editor-hex', hex);

      row.append(dot, name, code);
      list.appendChild(row);
    });

    const head = el('p', 'palette-editor-head',
      `${palette.colors.length} colours, read from ${palette.from === 'colors'
        ? 'the chart’s colour list' : 'each series'}.`);

    host.append(head, list, cvd.warn, cvd.sim);
    cvd.paint();
  }

  paint();
  return host;
}
