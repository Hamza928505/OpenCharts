/**
 * DataDialog.js — a full-size editor for pasting data.
 *
 * The inline box in the sidebar is fine for a glance and a small edit, but it
 * is roughly 260px wide and five rows tall, which is a poor place to paste a
 * spreadsheet. This gives that job the room it deserves, and shows what the
 * parser actually understood before anything is applied — the single most
 * useful thing when a paste does not do what you expected.
 */

import { parseTable, applyData, looksNumeric } from './dataio.js';
import { toast } from './toast.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * Open the editor.
 *
 * @param {object} def   chart definition
 * @param {object} spec  live spec — only mutated if the user applies a change
 * @param {Function} onApply called after a successful apply
 */
export function openDataDialog(def, spec, onApply) {
  const desc = def.data || {};

  const scrim = el('div', 'dlg-scrim');
  const dlg = el('div', 'dlg');
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.setAttribute('aria-label', 'Edit chart data');

  /* ── header ─────────────────────────────────────────────────────────── */
  const head = el('div', 'dlg-head');
  const titles = el('div');
  titles.appendChild(el('h2', 'dlg-title', 'Your data'));
  titles.appendChild(el('p', 'dlg-sub', `${def.title} — ${desc.hint || 'Paste a table below.'}`));
  const close = el('button', 'dlg-close', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  head.append(titles, close);

  /* ── body: editor on the left, parsed preview on the right ──────────── */
  const body = el('div', 'dlg-body');

  const leftCol = el('div', 'dlg-col');
  const editorLabel = el('label', 'dlg-label', 'Paste or type your table');
  const area = el('textarea', 'dlg-paste');
  area.spellcheck = false;
  // Seeded charts have no user data to show yet, so start from the example
  // rather than an empty box — there is then something concrete to edit.
  const current = typeof def.toText === 'function' ? def.toText(spec) : '';
  area.value = current && current.trim() ? current : (desc.example || '');
  area.setAttribute('aria-label', 'Chart data');

  const tools = el('div', 'dlg-tools');
  const exampleBtn = el('button', 'btn btn-sm', 'Load example');
  exampleBtn.type = 'button';
  const clearBtn = el('button', 'btn btn-sm', 'Clear');
  clearBtn.type = 'button';
  const rowCount = el('span', 'dlg-rowcount');
  tools.append(exampleBtn, clearBtn, rowCount);

  leftCol.append(editorLabel, area, tools);

  const rightCol = el('div', 'dlg-col');
  rightCol.appendChild(el('label', 'dlg-label', 'What OpenCharts reads'));
  const preview = el('div', 'dlg-preview');
  rightCol.appendChild(preview);
  const formatNote = el('p', 'dlg-note');
  formatNote.innerHTML =
    'Commas, tabs and semicolons all work — paste straight from Excel or Sheets. '
    + 'A header row is detected automatically, and <code>1,234</code>, <code>$99</code> '
    + 'and <code>42%</code> are all read as numbers.';
  rightCol.appendChild(formatNote);

  body.append(leftCol, rightCol);

  /* ── footer ─────────────────────────────────────────────────────────── */
  const foot = el('div', 'dlg-foot');
  const status = el('span', 'dlg-status');
  const cancel = el('button', 'btn', 'Cancel');
  cancel.type = 'button';
  const apply = el('button', 'btn btn-primary', 'Use this data');
  apply.type = 'button';
  foot.append(status, cancel, apply);

  dlg.append(head, body, foot);
  scrim.appendChild(dlg);
  document.body.appendChild(scrim);

  /* ── live preview of the parse ──────────────────────────────────────── */

  function refresh() {
    const table = parseTable(area.value);
    rowCount.textContent = table.rows.length
      ? `${table.rows.length} row${table.rows.length === 1 ? '' : 's'} · ${table.headers.length} column${table.headers.length === 1 ? '' : 's'}`
      : 'nothing to read yet';

    preview.innerHTML = '';
    if (!table.rows.length) {
      preview.appendChild(el('p', 'dlg-note', 'Paste something on the left and it will appear here.'));
      return;
    }

    const t = el('table', 'dlg-table');
    const thead = el('thead');
    const hr = el('tr');
    table.headers.forEach((h, i) => {
      const th = el('th', null, h);
      // Naming the role of each column is what makes a mis-paste obvious.
      const role = i === 0 ? 'labels' : 'values';
      th.appendChild(el('span', 'dlg-role', role));
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);

    const tbody = el('tbody');
    // Twelve rows is enough to see the shape without making the dialog scroll.
    table.rows.slice(0, 12).forEach((row) => {
      const tr = el('tr');
      table.headers.forEach((_, i) => {
        const cell = row[i] ?? '';
        // Flag anything in a value column that will not parse — "n/a", a stray
        // note, a merged cell. This is what makes a bad paste obvious before
        // it is applied rather than after the chart looks wrong.
        const unreadable = i > 0 && cell !== '' && !looksNumeric(cell);
        const td = el('td', unreadable ? 'bad' : null, cell);
        if (unreadable) td.title = 'This will be read as 0';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    preview.appendChild(t);

    if (table.rows.length > 12) {
      preview.appendChild(el('p', 'dlg-note', `…and ${table.rows.length - 12} more rows.`));
    }
    if (!table.hadHeader) {
      preview.appendChild(el('p', 'dlg-note',
        'No header row was detected, so the columns were named for you. Add one if you want your own names.'));
    }
  }

  /* ── behaviour ──────────────────────────────────────────────────────── */

  const dismiss = () => {
    document.removeEventListener('keydown', onKey);
    scrim.remove();
  };

  function onKey(e) {
    if (e.key === 'Escape') dismiss();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doApply();
  }

  function doApply() {
    const res = applyData(def, spec, area.value);
    if (!res.ok) {
      status.textContent = res.message;
      status.className = 'dlg-status bad';
      return;
    }
    toast(res.message, 'ok');
    onApply(res.message);
    dismiss();
  }

  area.addEventListener('input', refresh);
  exampleBtn.addEventListener('click', () => { area.value = desc.example || ''; refresh(); area.focus(); });
  clearBtn.addEventListener('click', () => { area.value = ''; refresh(); area.focus(); });
  apply.addEventListener('click', doApply);
  cancel.addEventListener('click', dismiss);
  close.addEventListener('click', dismiss);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) dismiss(); });
  document.addEventListener('keydown', onKey);

  refresh();
  // Focus the editor, but do not select its contents — the existing data is
  // usually a starting point rather than something to overwrite.
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);
}
