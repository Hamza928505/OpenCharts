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
import { applyData } from './dataio.js';

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
 * shape to parse into, and `dataio` does the reading. Charts whose sample data
 * is generated from parameters get a Sample/Yours switch, so the exploratory
 * mode survives alongside real input.
 */
function widgetData(ctrl, spec, notify, def) {
  const desc = def.data || {};
  const host = el('div', 'ctrl-group');
  host.style.gap = '.5rem';

  // Seeded charts keep their parameter controls; the switch hides or shows them.
  const switchable = !!desc.generated;
  let mode = spec.dataMode === 'observations' || spec.dataMode === 'bars'
    || spec.dataMode === 'regions' || spec.dataMode === 'cells' ? 'mine' : 'sample';

  if (switchable) {
    const seg = el('div', 'seg');
    const mk = (label, value) => {
      const b = el('button', 'seg-btn' + (mode === value ? ' active' : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => {
        mode = value;
        seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        if (value === 'sample') {
          // Drop back to generated data by clearing the override.
          delete spec.dataMode;
          if (desc.clearKeys) desc.clearKeys.forEach((k) => { delete spec[k]; });
          notify();
        }
        paint();
      });
      seg.appendChild(b);
      return b;
    };
    mk('Sample data', 'sample');
    mk('My data', 'mine');
    host.appendChild(seg);
  }

  const body = el('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:.4rem';
  host.appendChild(body);

  function paint() {
    body.innerHTML = '';
    if (switchable && mode === 'sample') {
      const note = el('p', 'data-note',
        desc.sampleNote || 'Data is generated from the settings below. Switch to “My data” to paste your own.');
      body.appendChild(note);
      return;
    }

    const area = el('textarea', 'input mono data-paste');
    area.rows = desc.rows || 7;
    area.spellcheck = false;
    area.placeholder = desc.placeholder || 'label,value\nAlpha,120\nBeta,90';
    area.value = typeof def.toText === 'function' ? def.toText(spec) : '';

    const status = el('div', 'data-status');
    // Carry over the confirmation from the rebuild that this paste triggered.
    if (spec._dataMessage) {
      status.textContent = spec._dataMessage;
      status.className = 'data-status ok';
      delete spec._dataMessage;
    }
    const hint = el('p', 'data-note', desc.hint || '');

    const apply = () => {
      const res = applyData(def, spec, area.value);
      status.textContent = res.message;
      status.className = 'data-status ' + (res.ok ? 'ok' : 'bad');
      if (!res.ok) return;

      notify();
      // A successful paste can change how many series exist, so the whole
      // panel is rebuilt — which destroys this status line. Stash the message
      // so the fresh panel can show it, or the confirmation just vanishes.
      spec._dataMessage = res.message;
      if (typeof host._rebuildAll === 'function') host._rebuildAll();
    };

    const actions = el('div');
    actions.style.cssText = 'display:flex;gap:.35rem';
    const applyBtn = el('button', 'btn btn-sm btn-primary', 'Use this data');
    applyBtn.type = 'button';
    applyBtn.style.flex = '1';
    applyBtn.addEventListener('click', apply);

    const sampleBtn = el('button', 'btn btn-sm', 'Example');
    sampleBtn.type = 'button';
    sampleBtn.title = 'Fill the box with correctly-shaped example data';
    sampleBtn.addEventListener('click', () => {
      area.value = desc.example || area.placeholder;
      area.focus();
    });

    actions.append(applyBtn, sampleBtn);

    // Ctrl/Cmd+Enter applies, which is what anyone pasting a table expects.
    area.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); apply(); }
    });

    body.append(area, actions, status);
    if (hint.textContent) body.appendChild(hint);
  }

  paint();
  return host;
}

const WIDGETS = {
  data:   widgetData,
  toggle: widgetToggle,
  seg:    widgetSeg,
  slider: widgetSlider,
  select: widgetSelect,
  text:   widgetText,
  labels: widgetLabels,
  series: widgetSeries,
  colors: widgetColors,
  values: widgetValues,
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

  // Parameter controls that only drive generated data are irrelevant once the
  // user has pasted their own. Hide those, but never the data editor itself —
  // it lives in the same group and must stay reachable to edit or revert.
  const usingOwnData = !!spec.dataMode;
  const hiddenGroups = new Set(usingOwnData ? (def.data && def.data.hideGroups) || [] : []);
  const visible = groups
    .map((g) => (hiddenGroups.has(g.name)
      ? { ...g, items: g.items.filter((c) => c.type === 'data') }
      : g))
    .filter((g) => g.items.length);

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
