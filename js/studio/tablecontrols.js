/**
 * tablecontrols.js — which sheet of a file, and which of its columns.
 *
 * Both are the reader's to decide, so both are on screen before any chart is.
 * A chart may read only some of a table, but nothing here removes a column on
 * its own: every column starts ticked, and only unticking takes one away.
 *
 * One component for the gallery's matcher, the studio's starting page and the
 * data editor, which would otherwise hold three ideas of what was chosen.
 */

import { looksNumeric } from './dataio.js';
import { looksDateLike } from './timeaxis.js';
import { project } from './DataMatch.js';
import { ALL_SHEETS } from './fileimport.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

/** What a column holds, in the words the matcher's report uses. */
function roleOf(table, column) {
  // The first filled cells rather than the first rows: in a stack of sheets a
  // column may hold nothing until the one sheet that has it.
  const cells = [];
  for (const row of table.rows) {
    const cell = String(row[column] ?? '').trim();
    if (cell) cells.push(cell);
    if (cells.length === 40) break;
  }
  if (!cells.length) return 'empty';
  if (cells.every(looksNumeric)) return 'numbers';
  return cells.filter(looksDateLike).length / cells.length >= 0.9 ? 'dates' : 'words';
}

/**
 * @param {object} handlers
 * @param {(csv: string) => void} handlers.onSheet     another sheet was read
 * @param {(table: object) => void} handlers.onColumns the ticks changed
 */
export function createTableControls({ onSheet, onColumns }) {
  const root = el('div', 'table-controls');
  root.hidden = true;

  const sheetRow = el('label', 'table-sheet');
  sheetRow.append(el('span', 'table-controls-label', 'Sheet'));
  const select = el('select', 'table-sheet-select');
  sheetRow.append(select);
  sheetRow.hidden = true;

  const notes = el('p', 'table-notes');
  notes.hidden = true;

  const fields = el('fieldset', 'table-columns');
  const legend = el('legend', 'table-controls-label');
  const list = el('div', 'table-column-list');
  fields.append(legend, list);
  fields.hidden = true;

  root.append(sheetRow, notes, fields);

  let file = null;
  let source = null;
  let order = [];

  const refreshRoot = () => { root.hidden = sheetRow.hidden && notes.hidden && fields.hidden; };

  const say = (lines) => {
    notes.textContent = (lines || []).join(' ');
    notes.hidden = !notes.textContent;
    refreshRoot();
  };

  /** Column positions for these headings, the same name twice taking each in turn. */
  const columnsNamed = (names) => {
    const taken = new Set();
    return names.map((name) => {
      const at = source.headers.findIndex((h, i) => h === name && !taken.has(i));
      if (at >= 0) taken.add(at);
      return at;
    }).filter((at) => at >= 0);
  };

  const chosen = () => {
    if (!source) return null;
    if (order.length === source.headers.length && order.every((c, i) => c === i)) return source;
    return {
      ...project(source, order),
      hadHeader: source.hadHeader !== false,
      skipped: source.skipped || 0,
      ...(source.swapped ? { swapped: true } : {}),
    };
  };

  function paint() {
    list.replaceChildren();
    fields.hidden = !source || source.headers.length < 2;
    refreshRoot();
    if (fields.hidden) return;
    legend.textContent = `Columns to use: ${order.length} of ${source.headers.length}`;
    source.headers.forEach((name, column) => {
      const label = el('label', 'table-column');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = order.includes(column);
      // A chart needs something to read, so the last tick stays.
      box.disabled = box.checked && order.length === 1;
      box.addEventListener('change', () => {
        if (box.checked) {
          // Back where it was in the file, unless the columns have been put in
          // another order on purpose; a chart reads its label from the first.
          const inFileOrder = order.every((c, i) => !i || order[i - 1] < c);
          order.push(column);
          if (inFileOrder) order.sort((a, b) => a - b);
        } else {
          order = order.filter((c) => c !== column);
        }
        paint();
        onColumns(chosen());
      });
      label.append(box, el('span', 'table-column-name', String(name)),
        el('span', 'table-column-role', roleOf(source, column)));
      label.title = String(name);
      list.append(label);
    });
  }

  select.addEventListener('change', async () => {
    if (!file || !file.pick) return;
    select.disabled = true;
    const out = await file.pick(select.value === 'all' ? ALL_SHEETS : select.value);
    select.disabled = false;
    if (!out.ok) { say([out.message]); return; }
    say(out.notes);
    onSheet(out.text);
  });

  return {
    el: root,
    chosen,

    /** What the reader of a file said about it. A new file starts with new ticks. */
    setFile(res) {
      file = res || null;
      source = null;
      order = [];
      const sheets = (res && res.sheets) || [];
      select.replaceChildren();
      sheetRow.hidden = sheets.length < 2;
      if (sheets.length > 1) {
        const all = el('option', null, `All ${sheets.length} sheets (adds a Sheet column)`);
        all.value = 'all';
        select.append(all);
        sheets.forEach((name) => {
          const option = el('option', null, name);
          option.value = name;
          select.append(option);
        });
        select.value = res.sheet;
      }
      say(res && res.notes);
    },

    /**
     * The whole table the columns are chosen from. The same headings keep the
     * reader's ticks, so typing in a cell does not undo them; new ones start
     * with every column ticked, or with `opening`, the names already in use.
     */
    setTable(table, opening = null) {
      const same = source && source.headers.length === table.headers.length
        && source.headers.every((h, i) => h === table.headers[i]);
      source = table;
      if (!same) order = opening ? columnsNamed(opening) : table.headers.map((_, i) => i);
      paint();
    },

    /** The ticks follow an undo in the grid, which can bring columns back or take them away. */
    showing(names) {
      if (!source) return;
      const next = columnsNamed(names);
      if (next.length === order.length && next.every((c, i) => c === order[i])) return;
      order = next;
      paint();
    },

    clear() {
      file = null;
      source = null;
      order = [];
      sheetRow.hidden = true;
      select.replaceChildren();
      say(null);
      paint();
    },
  };
}
