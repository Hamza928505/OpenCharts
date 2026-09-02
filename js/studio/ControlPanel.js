/**
 * ControlPanel.js — renders a chart's editing controls from a declarative
 * schema, so a new chart never has to hand-write sidebar markup.
 *
 * Every definition exposes `controls: [...]`. Each entry names a widget and a
 * dot-path into the spec; the panel wires the widget to that path and calls
 * `onChange()` whenever the value moves. Entries sharing a `group` are drawn
 * under one numbered heading in declaration order.
 */

import { SWATCHES, paletteAt } from './palette.js';
import { parseTable, applyData, expectedFormat, checkTableShape } from './dataio.js';
import { chooseDataFile } from './fileimport.js';
import { ask } from './confirm.js';
import { toast } from './toast.js';
import { openDataDialog } from './DataDialog.js';
import { createCombobox } from './Combobox.js';
import { createCheckList } from './CheckList.js';
import {
  loadCountries, loadCities, countryItems, findCountryEntry,
  loadCountryMeta, localCityName,
} from './geodata.js';
import { flagIcon } from './flags.js';
import { confusablePairs, describePairs, simulate, CVD_KINDS, paletteOf } from './cvd.js';
import { ANNOTATION_TYPES, newAnnotation, defaultArrow } from './annotate.js';
import {
  isFaceted, facetSource, facetableColumns, facetBySeries, facetByColumn,
  seriesKeyOf, scaleSharing, panelCount, panelColumns, facetNote,
} from './facet.js';

/* ── panel-scoped events ─────────────────────────────────────────────────── */

/**
 * Widgets that need to hear about each other.
 *
 * The country control and the city list are two widgets with one subject
 * between them, and only the panel knows they are siblings. Listeners are tied
 * to an AbortController that `buildControls` replaces on every rebuild, so a
 * panel's listeners die with the panel — the same discipline the geo charts
 * learned when five maps leaked a pair of window listeners per redraw.
 */
const COUNTRY_EVENT = 'oc:countries';
let panelScope = null;

function onPanelEvent(name, fn) {
  if (!panelScope) return;
  document.addEventListener(name, fn, { signal: panelScope.signal });
}

const emitPanelEvent = (name) => document.dispatchEvent(new CustomEvent(name));

/* ── spec path access ────────────────────────────────────────────────────── */

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => {
    if (o[k] == null || typeof o[k] !== 'object') {
      // A numeric next segment means this level is an array, not an object —
      // `opts.rotate.0` must not turn [0,-15,0] into {0:…}.
      o[k] = /^\d+$/.test(keys[keys.indexOf(k) + 1] ?? last) ? [] : {};
    }
    return o[k];
  }, obj);
  target[last] = value;
}

/* ── small builders ──────────────────────────────────────────────────────── */

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function field(labelText, valueText) {
  const wrap = el('div', 'field');
  const label = el('label', 'field-label');
  label.appendChild(el('span', null, labelText));
  if (valueText != null) {
    const v = el('span', 'field-val', valueText);
    label.appendChild(v);
    wrap._value = v;
  }
  wrap.appendChild(label);
  return wrap;
}

/** Parse a comma/newline separated list into numbers, keeping order. */
const parseNumbers = (text) =>
  text.split(/[,\n\s]+/).map((s) => s.trim()).filter(Boolean)
    .map((s) => { const n = Number(s); return Number.isFinite(n) ? n : 0; });

/** Parse a comma/newline separated list into trimmed strings. */
const parseLabels = (text) =>
  text.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);

/* ── colour picker popover ───────────────────────────────────────────────── */

function attachColourPicker(swatch, initial, onPick, onClear) {
  // A native <input type="color"> gives the OS picker for free; the swatch
  // strip above it covers the common case in one click.
  const input = document.createElement('input');
  input.type = 'color';
  input.value = /^#[0-9a-f]{6}$/i.test(initial) ? initial : '#666666';
  input.style.cssText = 'position:absolute;opacity:0;width:0;height:0;pointer-events:none';
  swatch.appendChild(input);

  let pop = null;
  const close = () => { if (pop) { pop.remove(); pop = null; document.removeEventListener('mousedown', onDoc, true); } };
  const onDoc = (e) => { if (pop && !pop.contains(e.target) && e.target !== swatch) close(); };

  swatch.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pop) { close(); return; }
    pop = el('div');
    pop.style.cssText =
      'position:absolute;z-index:70;margin-top:6px;padding:8px;display:grid;'
      + 'grid-template-columns:repeat(8,20px);gap:5px;background:var(--surface);'
      + 'border:1px solid var(--rule-firm);border-radius:10px;box-shadow:var(--shadow-lg)';
    SWATCHES.forEach((hex) => {
      const dot = el('button', 'palette-dot');
      dot.type = 'button';
      dot.style.background = hex;
      dot.style.width = '20px';
      dot.style.height = '20px';
      dot.title = hex;
      dot.addEventListener('click', (ev) => { ev.stopPropagation(); onPick(hex); close(); });
      pop.appendChild(dot);
    });
    const custom = el('button', 'palette-dot');
    custom.type = 'button';
    custom.title = 'Custom colour';
    custom.style.cssText =
      'width:20px;height:20px;background:conic-gradient(red,yellow,lime,aqua,blue,magenta,red);';
    custom.addEventListener('click', (ev) => { ev.stopPropagation(); input.click(); });
    pop.appendChild(custom);

    // Somewhere that has a default worth returning to needs a way back to it.
    // Only offered where the caller has one — a series colour is always a
    // colour, but an annotation's is "whatever the chart's ink is" until
    // somebody says otherwise.
    if (typeof onClear === 'function') {
      const auto = el('button', 'palette-auto', 'Auto');
      auto.type = 'button';
      auto.title = 'Back to the default colour';
      auto.addEventListener('click', (ev) => { ev.stopPropagation(); onClear(); close(); });
      pop.appendChild(auto);
    }

    swatch.style.position = 'relative';
    swatch.appendChild(pop);
    document.addEventListener('mousedown', onDoc, true);
  });

  input.addEventListener('input', (e) => onPick(e.target.value));
}

/* ── widgets ─────────────────────────────────────────────────────────────── */

function widgetToggle(ctrl, spec, notify) {
  const row = el('button', 'toggle-row');
  row.type = 'button';
  const track = el('span', 'toggle-track');
  track.appendChild(el('span', 'toggle-thumb'));
  const label = el('span', 'toggle-label', ctrl.label);
  row.append(track, label);

  const sync = () => track.classList.toggle('on', !!getPath(spec, ctrl.key));
  sync();
  row.addEventListener('click', () => {
    setPath(spec, ctrl.key, !getPath(spec, ctrl.key));
    sync();
    notify();
  });
  return row;
}

function widgetSeg(ctrl, spec, notify) {
  const wrap = field(ctrl.label);
  const seg = el('div', 'seg');
  const buttons = ctrl.options.map((opt) => {
    const b = el('button', 'seg-btn', opt.label);
    b.type = 'button';
    b.addEventListener('click', () => {
      setPath(spec, ctrl.key, opt.value);
      buttons.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      notify();
    });
    seg.appendChild(b);
    return b;
  });
  const current = getPath(spec, ctrl.key);
  const active = ctrl.options.findIndex((o) => o.value === current);
  buttons[active >= 0 ? active : 0].classList.add('active');
  wrap.appendChild(seg);
  return wrap;
}

function widgetSlider(ctrl, spec, notify) {
  const fmt = ctrl.format || ((v) => String(v));
  const wrap = field(ctrl.label, fmt(getPath(spec, ctrl.key)));
  const input = document.createElement('input');
  input.type = 'range';
  input.min = ctrl.min;
  input.max = ctrl.max;
  input.step = ctrl.step ?? 1;
  input.value = getPath(spec, ctrl.key);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    setPath(spec, ctrl.key, v);
    if (wrap._value) wrap._value.textContent = fmt(v);
    notify();
  });
  wrap.appendChild(input);
  return wrap;
}

function widgetSelect(ctrl, spec, notify) {
  const wrap = field(ctrl.label);
  const sel = el('select', 'select');
  ctrl.options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = String(opt.value);
    o.textContent = opt.label;
    sel.appendChild(o);
  });
  sel.value = String(getPath(spec, ctrl.key));
  sel.addEventListener('change', () => {
    const chosen = ctrl.options.find((o) => String(o.value) === sel.value);
    setPath(spec, ctrl.key, chosen ? chosen.value : sel.value);
    notify();
  });
  wrap.appendChild(sel);
  return wrap;
}

function widgetText(ctrl, spec, notify) {
  const wrap = field(ctrl.label);
  const input = el('input', 'input');
  input.type = 'text';
  input.value = getPath(spec, ctrl.key) ?? '';
  input.placeholder = ctrl.placeholder || '';
  input.addEventListener('input', () => {
    setPath(spec, ctrl.key, input.value);
    notify();
  });
  wrap.appendChild(input);
  return wrap;
}

function widgetLabels(ctrl, spec, notify) {
  const wrap = field(ctrl.label || 'Category labels');
  const input = el('textarea', 'input mono');
  input.value = (getPath(spec, ctrl.key || 'labels') || []).join(', ');
  input.rows = 2;
  input.addEventListener('change', () => {
    const next = parseLabels(input.value);
    if (next.length) {
      setPath(spec, ctrl.key || 'labels', next);
      notify();
    }
  });
  wrap.appendChild(input);
  return wrap;
}

/**
 * The series editor: colour, name, values and add/remove — the control most
 * charts actually need.
 */
function widgetSeries(ctrl, spec, notify, def) {
  const key = ctrl.key || 'series';
  const host = el('div', 'ctrl-group');
  host.style.gap = '.45rem';

  // The colour-vision check reaches here too. Half the library keeps a colour
  // per series inside this widget rather than in a `colors` control, and for a
  // long time that half was quietly exempt from a check the product presents
  // as universal — which is worse than not having the check, because the
  // silence reads as a pass.
  const coloured = () => paletteOf(def, spec).colors;
  const nameAt = (i) => paletteOf(def, spec).names[i] || '';
  const cvd = colourWarning(coloured, nameAt, () => paint());

  function paint() {
    host.innerHTML = '';
    const list = getPath(spec, key) || [];

    list.forEach((s, i) => {
      const row = el('div', 'series-row');
      row.style.flexWrap = 'wrap';

      const sw = el('span', 'swatch');
      // Simulated while previewing, but the picker still edits the real
      // colour: this is inspection, never an edit.
      const shown = s.color || paletteAt(i);
      sw.style.background = cvd.showing() ? simulate(shown, cvd.showing()) : shown;
      sw.title = 'Change colour';

      const meta = el('div', 'series-meta');
      const name = el('input', 'series-name');
      name.value = s.label ?? `Series ${i + 1}`;
      name.spellcheck = false;
      name.addEventListener('input', () => { s.label = name.value; notify(); });
      const hex = el('span', 'series-hex', s.color || paletteAt(i));
      meta.append(name, hex);

      attachColourPicker(sw, s.color || paletteAt(i), (colour) => {
        s.color = colour;
        sw.style.background = colour;
        hex.textContent = colour;
        notify();
      });

      row.append(sw, meta);

      if (ctrl.removable !== false && list.length > (ctrl.min || 1)) {
        const del = el('button', 'series-del', '✕');
        del.type = 'button';
        del.title = 'Remove series';
        del.addEventListener('click', () => { list.splice(i, 1); paint(); notify(); });
        row.appendChild(del);
      }

      if (ctrl.data) {
        const values = el('input', 'input mono');
        values.style.marginTop = '.4rem';
        values.style.flex = '1 1 100%';
        values.value = (s.data || []).join(', ');
        values.spellcheck = false;
        values.title = 'Comma-separated values';
        values.addEventListener('change', () => {
          const next = parseNumbers(values.value);
          if (next.length) { s.data = next; notify(); }
          else values.value = (s.data || []).join(', ');
        });
        row.appendChild(values);
      }

      host.appendChild(row);
    });

    const max = ctrl.max || 6;
    if (ctrl.addable !== false && list.length < max) {
      const add = el('button', 'btn btn-sm btn-block', '+ Add series');
      add.type = 'button';
      add.addEventListener('click', () => {
        const len = (list[0] && list[0].data ? list[0].data.length : (spec.labels || []).length) || 6;
        const base = list[0] && list[0].data ? list[0].data : null;
        list.push({
          label: `Series ${list.length + 1}`,
          color: paletteAt(list.length),
          data: Array.from({ length: len }, (_, i) => {
            const seed = base ? base[i % base.length] : 50;
            return Math.max(1, Math.round(seed * (0.55 + Math.random() * 0.7)));
          }),
        });
        paint();
        notify();
      });
      host.appendChild(add);
    }

    host.append(cvd.warn, cvd.sim);
    cvd.paint();
  }

  paint();
  host._repaint = paint;
  return host;
}

/** A flat list of colours driving a single multi-coloured dataset. */
/**
 * One colour, written straight to its dot-path.
 *
 * The plural `colors` widget needs an array at its key, which forces a chart to
 * keep a mirror field and sync it in onChange. For a single swatch — the text
 * colour on thirty charts — that ceremony buys nothing.
 */
function widgetColor(ctrl, spec, notify) {
  const wrap = field(ctrl.label || 'Colour');
  const strip = el('div', 'palette');
  const dot = el('span', 'palette-dot');
  const current = getPath(spec, ctrl.key) || ctrl.fallback || '#808080';
  dot.style.background = current;
  dot.title = current;
  attachColourPicker(dot, current, (next) => {
    setPath(spec, ctrl.key, next);
    dot.style.background = next;
    dot.title = next;
    notify();
  });
  strip.appendChild(dot);
  wrap.appendChild(strip);
  return wrap;
}

/**
 * The colour-vision warning and its simulate toggle.
 *
 * One component rather than a copy in each palette widget: the two widgets
 * edit different things — an array of hex, and an array of objects that happen
 * to carry one — but they make the *same* statement about the palette, and a
 * second copy of that statement is a second thing to keep true.
 *
 * `read()` hands back the colours whenever they are asked for rather than a
 * snapshot, because both widgets repaint on every edit and a captured list
 * would go stale on the first colour change.
 *
 * @param {() => string[]} read       the colours as they stand now
 * @param {(i:number) => string} nameAt  what to call colour i
 * @param {() => void} repaint       redraw the swatches in the new mode
 */
function colourWarning(read, nameAt, repaint) {
  const warn = el('p', 'palette-warn');
  const sim = el('button', 'palette-sim');
  sim.type = 'button';
  let showing = '';

  function paint() {
    // Only the colours this chart actually uses. Checking the whole 8-colour
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

function widgetColors(ctrl, spec, notify) {
  const key = ctrl.key || 'colors';
  const wrap = field(ctrl.label || 'Colours');
  const strip = el('div', 'palette');

  // A `colors` control usually points at an array of hex strings. The word
  // cloud points at its words, which carry a colour each — and reading those
  // as colours painted 28 blank swatches, a control that could not do the one
  // thing it is named for. Read and write one level down when the entry is an
  // object, so the strip works either way and a pick can never replace a word
  // with the colour it was given.
  const colourAt = (list, i) => {
    const entry = list[i];
    return (entry && typeof entry === 'object') ? (entry.color || '') : (entry || '');
  };
  const setColourAt = (list, i, next) => {
    const entry = list[i];
    if (entry && typeof entry === 'object') entry.color = next;
    else list[i] = next;
  };

  /** What to call series i in the warning — its own name if the chart has one. */
  const nameAt = (i) => {
    const names = ctrl.names && ctrl.names(spec);
    return (names && names[i]) || '';
  };

  const cvd = colourWarning(
    () => (getPath(spec, key) || []).map((_, i) => colourAt(getPath(spec, key) || [], i)),
    nameAt,
    () => paint(),
  );
  // Which deficiency the strip is currently showing, or '' for normal vision.
  const showingNow = () => cvd.showing();

  function paint() {
    strip.innerHTML = '';
    const list = getPath(spec, key) || [];
    list.forEach((_, i) => {
      const colour = colourAt(list, i);
      const dot = el('span', 'palette-dot');
      // The dot shows the simulated colour while previewing, but the picker
      // still edits the real one — you are inspecting the palette, not
      // recolouring the chart to something nobody chose.
      dot.style.background = showingNow() ? simulate(colour, showingNow()) : colour;
      dot.title = nameAt(i) || colour;
      attachColourPicker(dot, colour, (next) => {
        setColourAt(list, i, next);
        notify();
        paint();
      });
      strip.appendChild(dot);
    });
    cvd.paint();
  }

  wrap.append(strip, cvd.warn, cvd.sim);
  paint();
  wrap._repaint = paint;
  return wrap;
}

/**
 * Notes on the chart — the one control every chart in the library carries.
 *
 * **The panel holds what a note says; the chart holds where it goes.** Two
 * number fields are a poor way to find the spot a label looks right in, and a
 * good way to make somebody count pixels — so position is dragged on the plate
 * and never appears here. The hint below the list is the only thing that says
 * so, which is why it is not optional.
 *
 * Adding is three buttons rather than a type dropdown plus an Add: picking
 * what to add *is* the action, and one click should do it.
 */
function widgetAnnotations(ctrl, spec, notify) {
  const key = ctrl.key || 'annotations';
  const wrap = field(ctrl.label || 'Notes on the chart');
  const list = el('div', 'annot-list');
  const adder = el('div', 'annot-add');

  /** The live array, created on first use so an unannotated spec stays clean. */
  const ensure = () => {
    let items = getPath(spec, key);
    if (!Array.isArray(items)) { items = []; setPath(spec, key, items); }
    return items;
  };
  const current = () => (Array.isArray(getPath(spec, key)) ? getPath(spec, key) : []);

  /** A structural change repaints the list; a typed character does not. */
  const changed = (repaint) => { if (repaint) paint(); notify(); };

  function row(a, i) {
    const kind = ANNOTATION_TYPES.find((t) => t.type === a.type) || ANNOTATION_TYPES[0];
    const node = el('div', 'annot-row');
    node.dataset.i = String(i);

    const glyph = el('span', 'annot-kind', kind.glyph);
    glyph.title = kind.label;
    node.appendChild(glyph);

    const text = el('input', 'input annot-text');
    text.type = 'text';
    text.value = a.text || '';
    text.placeholder = a.type === 'note' ? 'Say what it marks' : 'Label (optional)';
    text.addEventListener('input', () => { a.text = text.value; changed(false); });
    node.appendChild(text);

    // One button whose job depends on the kind. A rule and a band need to turn
    // ninety degrees; a note needs to be able to point at something.
    const flip = el('button', 'annot-btn');
    flip.type = 'button';
    if (a.type === 'note') {
      flip.textContent = '↗';
      flip.classList.toggle('is-on', !!a.arrow);
      flip.title = a.arrow ? 'Remove the arrow' : 'Point an arrow at something';
      flip.addEventListener('click', () => {
        a.arrow = a.arrow ? null : defaultArrow(a);
        changed(true);
      });
    } else {
      const upright = a.axis === 'x';
      flip.textContent = upright ? '↕' : '↔';
      flip.title = upright ? 'Vertical — click to lay it flat' : 'Horizontal — click to stand it up';
      flip.addEventListener('click', () => {
        a.axis = upright ? 'y' : 'x';
        changed(true);
      });
    }
    node.appendChild(flip);

    const dot = el('span', 'palette-dot annot-dot');
    dot.style.background = a.color || 'transparent';
    if (!a.color) dot.classList.add('is-auto');
    dot.title = a.color || 'Default colour';
    attachColourPicker(dot, a.color || '#6C63D8',
      (hex) => { a.color = hex; changed(true); },
      () => { delete a.color; changed(true); });
    node.appendChild(dot);

    const del = el('button', 'annot-btn annot-del', '✕');
    del.type = 'button';
    del.title = 'Remove';
    del.addEventListener('click', () => {
      current().splice(i, 1);
      changed(true);
    });
    node.appendChild(del);

    return node;
  }

  function paint() {
    list.innerHTML = '';
    const items = current();
    if (!items.length) {
      const blank = el('p', 'annot-empty', 'Nothing marked yet.');
      list.appendChild(blank);
    } else {
      items.forEach((a, i) => list.appendChild(row(a, i)));
    }
    hint.hidden = !items.length;
  }

  const hint = el('p', 'annot-hint', 'Drag it on the chart to place it.');

  ANNOTATION_TYPES.forEach((t) => {
    const add = el('button', 'btn btn-sm annot-new', `+ ${t.label}`);
    add.type = 'button';
    add.title = t.hint;
    add.addEventListener('click', () => {
      const items = ensure();
      items.push(newAnnotation(t.type, items.length));
      changed(true);
    });
    adder.appendChild(add);
  });

  wrap.append(list, adder, hint);
  paint();
  return wrap;
}

/** Editable numeric values for a single-dataset chart. */
function widgetValues(ctrl, spec, notify) {
  const key = ctrl.key || 'values';
  const wrap = field(ctrl.label || 'Values');
  const input = el('textarea', 'input mono');
  input.rows = 2;
  input.value = (getPath(spec, key) || []).join(', ');
  input.spellcheck = false;
  input.addEventListener('change', () => {
    const next = parseNumbers(input.value);
    if (next.length) { setPath(spec, key, next); notify(); }
    else input.value = (getPath(spec, key) || []).join(', ');
  });
  wrap.appendChild(input);
  return wrap;
}

/**
 * The "Your data" editor.
 *
 * One widget serves every chart: the definition's `data` descriptor says what
 * shape to parse into, and `dataio` does the reading.
 *
 * The sidebar shows the data rather than asking anyone to type it here. A
 * 260px-wide textarea is a bad place to write a table — no structure, no
 * feedback until you commit, and one missing comma shifts a whole row — so
 * editing happens in the grid, and this stays a readable summary of it.
 */
function widgetData(ctrl, spec, notify, def) {
  const desc = def.data || {};
  const host = el('div', 'ctrl-group');
  host.style.gap = '.5rem';

  const body = el('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:.4rem';
  host.appendChild(body);

  /**
   * Take a file straight from the sidebar.
   *
   * A file arrives in whatever shape its author chose, which is rarely the one
   * this chart reads. So it is checked against the chart's own format before
   * anything is applied, and a mismatch offers the editor rather than drawing
   * something wrong and leaving the reader to work out why.
   */
  const uploadFile = async () => {
    const res = await chooseDataFile();
    if (!res) return;                       // dialog dismissed

    if (!res.ok) {
      await ask({ title: 'That file could not be read', text: res.message, tone: 'stop', confirm: 'OK' });
      return;
    }

    const table = parseTable(res.text, expectedFormat(def).columns);
    const fit = checkTableShape(def, table);
    if (!fit.ok) {
      const open = await ask({
        title: `${res.name} does not match this chart`,
        text: fit.message,
        list: [
          `This chart reads: ${fit.expected.columns.join(', ') || fit.expected.hint}`,
          `Your file has: ${table.headers.join(', ')}`,
          fit.expected.grows ? `Note: ${fit.expected.grows}` : null,
        ].filter(Boolean),
        tone: 'stop',
        confirm: 'Open the editor',
        cancel: 'Cancel',
      });
      // The grid is where a near miss gets fixed — renaming a column or
      // deleting a stray one — rather than being refused outright.
      if (open) openDataDialog(def, spec, afterApply, res.text);
      return;
    }

    const applied = applyData(def, spec, res.text);
    if (!applied.ok) {
      await ask({ title: 'That file could not be used', text: applied.message, tone: 'stop', confirm: 'OK' });
      return;
    }
    toast(`${res.name} — ${applied.message}`, 'ok');
    afterApply(applied.message);
  };

  const afterApply = (message) => {
    notify();
    spec._dataMessage = message;
    if (typeof host._rebuildAll === 'function') host._rebuildAll();
  };

  const openEditor = () => {
    openDataDialog(def, spec, (message) => {
      notify();
      // Applying can change how many series exist, so the whole panel is
      // rebuilt — which destroys this widget. Stash the confirmation so the
      // fresh panel can show it instead of it vanishing.
      spec._dataMessage = message;
      if (typeof host._rebuildAll === 'function') host._rebuildAll();
    });
  };

  function paint() {
    body.innerHTML = '';

    const current = typeof def.toText === 'function' ? def.toText(spec) : '';
    // Both of these are written by this project, so their header row is not
    // in doubt — which matters for the charts whose columns are years.
    const table = parseTable(current && current.trim() ? current : (desc.example || ''), true);

    const card = el('div', 'data-card');
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.title = 'Open the data editor';

    if (table.rows.length) {
      // Four columns and four rows is enough to recognise your own data at a
      // glance; anything more is unreadable at sidebar width anyway.
      const shownCols = Math.min(table.headers.length, 4);
      const shownRows = Math.min(table.rows.length, 4);
      const t = el('table', 'data-mini');
      const thead = el('thead');
      const hr = el('tr');
      for (let c = 0; c < shownCols; c++) hr.appendChild(el('th', null, table.headers[c]));
      if (table.headers.length > shownCols) hr.appendChild(el('th', 'more', '…'));
      thead.appendChild(hr);
      t.appendChild(thead);

      const tbody = el('tbody');
      for (let r = 0; r < shownRows; r++) {
        const tr = el('tr');
        for (let c = 0; c < shownCols; c++) tr.appendChild(el('td', null, table.rows[r][c] ?? ''));
        if (table.headers.length > shownCols) tr.appendChild(el('td', 'more', '…'));
        tbody.appendChild(tr);
      }
      t.appendChild(tbody);
      card.appendChild(t);

      const count = el('p', 'data-count',
        `${table.rows.length} row${table.rows.length === 1 ? '' : 's'} · ${table.headers.length} column${table.headers.length === 1 ? '' : 's'}`
        + (table.rows.length > shownRows ? ` — showing the first ${shownRows}` : ''));
      card.appendChild(count);
    } else {
      card.appendChild(el('p', 'data-note', 'No data yet. Open the editor to add some.'));
    }

    card.addEventListener('click', openEditor);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(); }
    });

    const status = el('div', 'data-status');
    // Carry over the confirmation from the rebuild that applying triggered.
    if (spec._dataMessage) {
      status.textContent = spec._dataMessage;
      status.className = 'data-status ok';
      delete spec._dataMessage;
    }

    const editBtn = el('button', 'btn btn-sm btn-primary', 'Edit data');
    editBtn.type = 'button';
    editBtn.style.width = '100%';
    editBtn.addEventListener('click', openEditor);

    const uploadBtn = el('button', 'btn btn-sm', 'Upload a file');
    uploadBtn.type = 'button';
    uploadBtn.style.width = '100%';
    uploadBtn.title = 'Open a .xlsx, .csv, .tsv or .txt — nothing is uploaded anywhere';
    uploadBtn.addEventListener('click', uploadFile);

    body.append(card, editBtn, uploadBtn, status);

    // What this chart actually reads, in the columns' own words. Stated before
    // a file is chosen, not after it fails — the whole point is that a reader
    // should know the shape in advance.
    const fmt = expectedFormat(def);
    if (fmt.columns.length) {
      const spec2 = el('p', 'data-format');
      spec2.append(el('span', 'data-format-label', 'Expects'));
      spec2.append(el('code', null, fmt.columns.join(', ')));
      // `grows` is deliberately not repeated here — the hint below already
      // says how further columns are read, on every chart that has one.
      body.appendChild(spec2);
    }

    const hint = el('p', 'data-note', desc.hint || '');
    if (hint.textContent) body.appendChild(hint);
  }

  paint();
  return host;
}

/**
 * Countries chosen from the map's own list, as many as you like.
 *
 * Chips plus a search box rather than a long checklist: the sidebar is 260px
 * wide, and the common case is two or three countries, not fifty. The full
 * ticked list lives in the data editor, where there is room for it.
 *
 * Free text was wrong here from the start: the atlas spells countries its own
 * way ("Bosnia and Herz.", "Dem. Rep. Congo"), so a reasonable guess matched
 * nothing and the map stayed silently on the world.
 */
function widgetCountries(ctrl, spec, notify) {
  const wrap = field(ctrl.label || 'Countries');
  const chips = el('div', 'country-chips');
  wrap.appendChild(chips);

  /** Atlas name → ISO2, so a chip can find its own flag. Empty until loaded. */
  const isoByName = new Map();

  const box = createCombobox({
    items: [],
    placeholder: ctrl.placeholder || 'Loading countries…',
    emptyText: 'No country by that name',
    // The item's `icon` is an ISO2 code; turning it into a picture is this
    // call site's job, because this is the one that knows it lists countries.
    renderIcon: (iso2) => flagIcon(iso2),
    onSelect: (value) => {
      if (!value) return;
      const list = getPath(spec, ctrl.key) || [];
      if (list.indexOf(value) < 0) {
        setPath(spec, ctrl.key, [...list, value]);
        paint();
        notify();
        emitPanelEvent(COUNTRY_EVENT);
      }
      // Clear the box so the next one can be typed straight away.
      box.setValue('');
      box.focus();
    },
  });
  wrap.appendChild(box.el);

  function paint() {
    chips.innerHTML = '';
    const list = getPath(spec, ctrl.key) || [];
    if (!list.length) {
      chips.appendChild(el('span', 'country-empty', ctrl.emptyLabel || 'Whole world'));
      return;
    }
    list.forEach((name, i) => {
      const chip = el('span', 'country-chip');
      // `iso` is filled in once the country list has loaded — a chip painted
      // before then is a name with no flag, not a broken one.
      const iso = isoByName.get(name);
      if (iso) chip.appendChild(flagIcon(iso));
      // Named, because the flag is a bare span in here too and `> span` used
      // to be a reliable way of saying "the country".
      chip.appendChild(el('span', 'country-chip-name', name));
      const x = el('button', 'country-chip-x', '✕');
      x.type = 'button';
      x.title = `Remove ${name}`;
      x.addEventListener('click', () => {
        const next = (getPath(spec, ctrl.key) || []).filter((_, k) => k !== i);
        setPath(spec, ctrl.key, next);
        paint();
        notify();
        emitPanelEvent(COUNTRY_EVENT);
      });
      chip.appendChild(x);
      chips.appendChild(chip);
    });
  }

  loadCountries().then((all) => {
    all.forEach((c) => { if (c.iso2) isoByName.set(c.name, c.iso2); });
    box.setItems(countryItems(all, { onlyWithCities: !!ctrl.onlyWithCities }));
    paint();
    // Normalise whatever the spec held to the atlas's own spelling, so a saved
    // config that said "USA" now shows — and matches — the real feature.
    const list = getPath(spec, ctrl.key) || [];
    const fixed = list
      .map((name) => { const hit = findCountryEntry(all, name); return hit ? hit.name : name; })
      .filter((name, i, a) => a.indexOf(name) === i);
    if (fixed.length !== list.length || fixed.some((n, i) => n !== list[i])) {
      setPath(spec, ctrl.key, fixed);
      paint();
      notify();
    }
    const input = box.el.querySelector('.cbx-input');
    if (input) input.placeholder = ctrl.placeholder || 'Add a country…';
  }).catch(() => {
    const input = box.el.querySelector('.cbx-input');
    if (input) input.placeholder = 'Country list unavailable';
  });

  paint();
  return wrap;
}

/* ── cities ──────────────────────────────────────────────────────────────── */

/**
 * The country's own cities, ticked straight onto the map.
 *
 * Picking places used to mean opening the data editor, finding the right tab,
 * choosing a country a second time and coming back. But a map is already
 * focused on a country, and that country already knows its cities — so the
 * list belongs under the country control, where the choice was made.
 *
 * A ticked city keeps whatever value it already had. New ones arrive at 1,
 * which is what a blank fourth column parses to anyway; inventing a plausible
 * number instead would put figures on the map that are nobody's.
 */
function widgetCities(ctrl, spec, notify) {
  const key = ctrl.key || 'places';
  const from = ctrl.from || 'opts.countries';
  const valueField = ctrl.valueField || 'value';
  const BULK_CONFIRM = 400;

  const wrap = field(ctrl.label || 'Cities');
  const note = el('p', 'cities-note', 'Loading…');
  wrap.appendChild(note);

  const list = createCheckList({
    placeholder: 'Search cities…',
    emptyText: 'Choose a country above and its cities appear here.',
    renderIcon: (iso2) => flagIcon(iso2),
    onChange: (picked) => apply(picked),
  });
  wrap.appendChild(list.el);

  const actions = el('div', 'cities-actions');
  const allBtn = el('button', 'btn btn-sm', 'Add every city');
  allBtn.type = 'button';
  allBtn.disabled = true;
  actions.appendChild(allBtn);
  wrap.appendChild(actions);

  /** Every city of the focused countries, by name. Empty until they load. */
  let universe = new Map();
  let countryNames = [];

  const places = () => getPath(spec, key) || [];

  function apply(picked) {
    const chosen = new Set(picked);
    const existing = new Map(places().map((p) => [String(p.name), p]));

    // Places the reader typed themselves, or that came from another country,
    // are not this list's to remove — only the ones it is showing.
    const kept = places().filter((p) => !universe.has(String(p.name)));
    const added = picked.map((name) => {
      const had = existing.get(name);
      if (had) return had;
      const city = universe.get(name);
      return { name, lon: city.lon, lat: city.lat, [valueField]: 1 };
    });

    setPath(spec, key, kept.concat(added));
    paintNote(chosen.size);
    notify();
  }

  function paintNote(n) {
    if (!universe.size) return;
    const where = countryNames.length === 1 ? ` in ${countryNames[0]}`
      : countryNames.length ? ` across ${countryNames.length} countries` : '';
    note.textContent = `${n} of ${universe.size.toLocaleString()} cities${where} are on the map.`
      + (n ? ' Values live in the data editor.' : '');
  }

  allBtn.addEventListener('click', async () => {
    const names = [...universe.keys()];
    if (names.length > BULK_CONFIRM) {
      const yes = await ask({
        title: `Add all ${names.length.toLocaleString()} cities?`,
        text: `That is a lot of marks for one map, and every one of them starts at the `
          + `same value. It will draw, but it may be slow and hard to read.`,
        tone: 'warn',
        confirm: 'Add them all',
        cancel: 'Never mind',
      });
      if (!yes) return;
    }
    list.setSelected(names);
    apply(names);
  });

  /* ── load ─────────────────────────────────────────────────────────────── */

  loadCountries().then(async (all) => {
    // Local spellings are decoration, so the list must not wait on them
    // failing — `localCityName` simply answers '' until they arrive.
    await loadCountryMeta().catch(() => {});
    const wanted = [].concat(getPath(spec, from) || []).filter(Boolean);
    const entries = wanted.map((n) => findCountryEntry(all, n)).filter((c) => c && c.iso2);
    countryNames = entries.map((c) => c.name);

    if (!entries.length) {
      note.textContent = 'Focus on a country above, and its cities are listed here to tick.';
      return;
    }

    const lists = await Promise.all(entries.map((c) => loadCities(c.iso2)));
    universe = new Map();
    lists.forEach((cities, i) => cities.forEach((c) => {
      // Two countries can share a city name; the first one focused wins, which
      // is the same rule the map itself uses for overlapping marks.
      if (!universe.has(c.name)) {
        universe.set(c.name, { ...c, country: entries[i].name, iso2: entries[i].iso2 });
      }
    }));

    const many = entries.length > 1;
    list.setItems([...universe.values()].map((c) => {
      // The curated list names about five cities per country, so most rows
      // have no local spelling and simply do not get one. Inventing a
      // transliteration for the other 156,000 would put names on the map
      // that no source stands behind.
      const local = localCityName(c.iso2, c.name);
      return {
        value: c.name,
        label: c.name,
        sub: local,
        search: local ? `${c.name} ${local}` : c.name,
        // A flag only earns its place when the list spans countries; on a
        // single-country map it would be the same picture on every row.
        icon: many ? c.iso2 : '',
        note: many ? c.country : '',
      };
    }), true);

    const on = places().map((p) => String(p.name)).filter((n) => universe.has(n));
    list.setSelected(on);
    allBtn.disabled = !universe.size;
    paintNote(on.length);
  }).catch(() => {
    note.textContent = 'The city list could not be loaded. The data editor still works.';
  });

  // The country control is a separate widget, so the list has to be told when
  // the focus changes rather than noticing on its own.
  onPanelEvent(COUNTRY_EVENT, () => wrap._rebuildAll && wrap._rebuildAll());

  return wrap;
}

/* ── small multiples ─────────────────────────────────────────────────────── */

/**
 * The facet control.
 *
 * One dropdown decides what a panel *is* — a series, or a value of a column —
 * and everything under it is layout. Deliberately one choice rather than a
 * row-and-column matrix: nesting two facets multiplies the panel count by
 * itself, and a grid nobody can read is not a comparison.
 *
 * The column options come from the table the facet is already holding, so a
 * reader can move the split from Region to Quarter without reopening the data
 * editor. Getting the first column in there is the editor's job — a chart
 * opening on its example has no spare column to offer.
 */
function widgetFacet(ctrl, spec, notify, def) {
  const wrap = el('div', 'facet-ctrl');
  const share = scaleSharing(def);
  const source = facetSource(spec);
  const columns = source ? facetableColumns(source) : [];
  const on = isFaceted(spec);

  const rebuild = () => { notify(); if (wrap._rebuildAll) wrap._rebuildAll(); };

  /* what a panel is */
  const pick = field(ctrl.label || 'Split into panels');
  const sel = el('select', 'select');
  const options = [{ value: '', label: 'Off — one chart' }];
  if (seriesKeyOf(def)) options.push({ value: 'series', label: 'One panel per series' });
  columns.forEach((c) => options.push({
    value: `col:${c.col}`,
    label: `One panel per ${c.name} (${c.values})`,
  }));
  options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    sel.appendChild(o);
  });

  const currentValue = () => {
    if (!on) return '';
    if (spec.facet.kind === 'series') return 'series';
    const i = source ? (source.headers || []).indexOf(spec.facet.by) : -1;
    return i >= 0 ? `col:${i}` : '';
  };
  sel.value = currentValue();
  if (sel.value !== currentValue()) sel.value = '';

  sel.addEventListener('change', () => {
    const chosen = sel.value;
    const previous = spec.facet;
    delete spec.facet;
    if (!chosen) { rebuild(); return; }

    const res = chosen === 'series'
      ? facetBySeries(def, spec)
      : facetByColumn(def, spec, source, Number(chosen.slice(4)));
    if (!res.ok) {
      // Put back what was on screen rather than silently dropping to one
      // chart: the reader asked for a different split, not for none.
      if (previous) spec.facet = previous;
      toast(res.message);
    }
    rebuild();
  });
  pick.appendChild(sel);
  wrap.appendChild(pick);

  if (!on) {
    if (!columns.length) {
      wrap.appendChild(el('p', 'facet-note', seriesKeyOf(def)
        ? 'Or open the data editor and split by a column of your own table.'
        : 'Open the data editor and split by a column of your own table.'));
    }
    return wrap;
  }

  /* layout */
  const count = panelCount(def, spec);
  const across = field('Panels across', String(panelColumns(count, spec.facet.cols)));
  const acrossSel = el('select', 'select');
  [{ value: 0, label: 'Fit to the panel count' }, ...[1, 2, 3, 4].map((n) => ({
    value: n, label: `${n} across`,
  }))].forEach((opt) => {
    const o = document.createElement('option');
    o.value = String(opt.value);
    o.textContent = opt.label;
    acrossSel.appendChild(o);
  });
  acrossSel.value = String(spec.facet.cols || 0);
  acrossSel.addEventListener('change', () => {
    spec.facet.cols = Number(acrossSel.value) || 0;
    across._value.textContent = String(panelColumns(count, spec.facet.cols));
    notify();
  });
  across.appendChild(acrossSel);
  wrap.appendChild(across);

  /* scales — and what the answer actually means for this chart */
  const scales = field('Scales');
  const seg = el('div', 'seg');
  const modes = [
    { value: 'shared', label: 'Matched' },
    { value: 'free', label: 'Independent' },
  ];
  const buttons = modes.map((m) => {
    const b = el('button', 'seg-btn', m.label);
    b.type = 'button';
    // A chart that computes its own domain inside a serialised `draw` cannot
    // be told what axis to use, so the switch is disabled rather than offered
    // and ignored. The sentence under it says why.
    b.disabled = !share.can && m.value === 'shared';
    b.addEventListener('click', () => {
      if (b.disabled) return;
      spec.facet.scales = m.value;
      buttons.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      notify();
    });
    seg.appendChild(b);
    return b;
  });
  const active = share.can && spec.facet.scales !== 'free' ? 0 : 1;
  buttons[active].classList.add('active');
  scales.appendChild(seg);
  wrap.appendChild(scales);

  wrap.appendChild(el('p', 'facet-note', share.why));

  const capped = facetNote(def, spec);
  if (capped) wrap.appendChild(el('p', 'facet-warn', capped));

  return wrap;
}

const WIDGETS = {
  data:    widgetData,
  facet:   widgetFacet,
  toggle:  widgetToggle,
  seg:     widgetSeg,
  slider:  widgetSlider,
  select:  widgetSelect,
  text:    widgetText,
  countries: widgetCountries,
  cities:  widgetCities,
  labels:  widgetLabels,
  series:  widgetSeries,
  color:   widgetColor,
  colors:  widgetColors,
  values:  widgetValues,
  annotations: widgetAnnotations,
};

/* ── panel ───────────────────────────────────────────────────────────────── */

/**
 * Render the whole control panel.
 *
 * @param {HTMLElement} container
 * @param {object} def   chart definition
 * @param {object} spec  live spec (mutated in place by the widgets)
 * @param {Function} onChange  called after any edit
 */
export function buildControls(container, def, spec, onChange) {
  // Anything the previous panel was listening for goes with it.
  if (panelScope) panelScope.abort();
  panelScope = new AbortController();

  container.innerHTML = '';
  const controls = def.controls || [];

  if (!controls.length) {
    const note = el('p', 'lede');
    note.style.fontSize = '13px';
    note.textContent = 'This chart renders from a fixed dataset. Use the code panel below to copy and adapt it.';
    container.appendChild(note);
    return;
  }

  // Group consecutive entries by their `group` label, preserving order.
  const groups = [];
  controls.forEach((ctrl) => {
    const name = ctrl.group || 'Options';
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(ctrl);
    else groups.push({ name, items: [ctrl] });
  });

  const visible = groups.filter((g) => g.items.length);

  visible.forEach((group, gi) => {
    if (gi > 0) container.appendChild(el('hr', 'ctrl-divider'));

    const block = el('div', 'ctrl-group');
    const head = el('div', 'ctrl-head');
    head.appendChild(el('span', 'ctrl-step', String(gi + 1).padStart(2, '0')));
    head.appendChild(el('span', null, group.name));
    block.appendChild(head);

    group.items.forEach((ctrl) => {
      const make = WIDGETS[ctrl.type];
      if (!make) {
        console.warn(`[ControlPanel] unknown control type "${ctrl.type}"`);
        return;
      }
      const node = make(ctrl, spec, onChange, def);
      // The data editor can change how many series exist, so let it ask for a
      // full panel rebuild rather than leaving stale rows on screen.
      node._rebuildAll = () => buildControls(container, def, spec, onChange);
      block.appendChild(node);
    });

    container.appendChild(block);
  });
}
