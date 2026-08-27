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
import { loadCountries, countryItems, findCountryEntry } from './geodata.js';

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

function attachColourPicker(swatch, initial, onPick) {
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
function widgetSeries(ctrl, spec, notify) {
  const key = ctrl.key || 'series';
  const host = el('div', 'ctrl-group');
  host.style.gap = '.45rem';

  function paint() {
    host.innerHTML = '';
    const list = getPath(spec, key) || [];

    list.forEach((s, i) => {
      const row = el('div', 'series-row');
      row.style.flexWrap = 'wrap';

      const sw = el('span', 'swatch');
      sw.style.background = s.color || paletteAt(i);
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

function widgetColors(ctrl, spec, notify) {
  const key = ctrl.key || 'colors';
  const wrap = field(ctrl.label || 'Colours');
  const strip = el('div', 'palette');

  function paint() {
    strip.innerHTML = '';
    const list = getPath(spec, key) || [];
    list.forEach((colour, i) => {
      const dot = el('span', 'palette-dot');
      dot.style.background = colour;
      dot.title = (ctrl.names && ctrl.names(spec)[i]) || colour;
      attachColourPicker(dot, colour, (next) => {
        list[i] = next;
        dot.style.background = next;
        notify();
      });
      strip.appendChild(dot);
    });
  }

  paint();
  wrap.appendChild(strip);
  wrap._repaint = paint;
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

  const box = createCombobox({
    items: [],
    placeholder: ctrl.placeholder || 'Loading countries…',
    emptyText: 'No country by that name',
    onSelect: (value) => {
      if (!value) return;
      const list = getPath(spec, ctrl.key) || [];
      if (list.indexOf(value) < 0) {
        setPath(spec, ctrl.key, [...list, value]);
        paint();
        notify();
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
      chip.appendChild(el('span', null, name));
      const x = el('button', 'country-chip-x', '✕');
      x.type = 'button';
      x.title = `Remove ${name}`;
      x.addEventListener('click', () => {
        const next = (getPath(spec, ctrl.key) || []).filter((_, k) => k !== i);
        setPath(spec, ctrl.key, next);
        paint();
        notify();
      });
      chip.appendChild(x);
      chips.appendChild(chip);
    });
  }

  loadCountries().then((all) => {
    box.setItems(countryItems(all, { onlyWithCities: !!ctrl.onlyWithCities }));
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

const WIDGETS = {
  data:    widgetData,
  toggle:  widgetToggle,
  seg:     widgetSeg,
  slider:  widgetSlider,
  select:  widgetSelect,
  text:    widgetText,
  countries: widgetCountries,
  labels:  widgetLabels,
  series:  widgetSeries,
  color:   widgetColor,
  colors:  widgetColors,
  values:  widgetValues,
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
