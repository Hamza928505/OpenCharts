/**
 * DataGrid.js — a small spreadsheet for entering chart data.
 *
 * Typing CSV into a textarea is a poor way to enter numbers: there is no
 * structure, no validation until you commit, and one missing comma silently
 * shifts a whole row. This gives the same data a real grid — click a cell,
 * type, Tab to the next — with validation as you go.
 *
 * Pasting still works, and works well: paste a block from a spreadsheet into
 * any cell and it fills the grid from that point.
 */

import { looksNumeric, columnRules, countOf } from './dataio.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * @param {object} opts
 * @param {string[]} opts.headers
 * @param {string[][]} opts.rows
 * @param {string} [opts.shape] the data shape, which decides how many leading
 *   columns hold words and what "+ Column" adds. See `columnRules` in dataio.
 * @param {Function} [opts.onChange] called with { headers, rows } after any edit
 * @returns {{ el, getData, setData, addRow, validate }}
 */
export function createDataGrid(opts) {
  let headers = [...(opts.headers || ['Label', 'Value'])];
  let rows = (opts.rows || []).map((r) => [...r]);
  const minRows = opts.minRows || 1;

  // How many columns hold words depends on the shape, and for a flow or a
  // hierarchy it depends on how wide the table currently is — so it is asked
  // for on every render rather than fixed when the grid is built.
  const rules = columnRules(opts.shape);
  const labelCount = () => Math.max(0, Math.min(headers.length, countOf(rules.text, headers)));
  const requiredCount = () => Math.min(labelCount(), countOf(rules.filled, headers));
  const addSpec = rules.add;

  const root = el('div', 'dgrid-wrap');
  const scroll = el('div', 'dgrid-scroll');
  const table = el('table', 'dgrid');
  scroll.appendChild(table);

  const foot = el('div', 'dgrid-foot');
  const addRowBtn = el('button', 'btn btn-sm', '+ Row');
  addRowBtn.type = 'button';
  const addColBtn = el('button', 'btn btn-sm', (addSpec && addSpec.label) || '+ Column');
  addColBtn.type = 'button';
  const summary = el('span', 'dgrid-summary');
  foot.append(addRowBtn, addColBtn, summary);
  // On a shape that reads a fixed set of columns, another one would be
  // dropped in silence. Offering the button anyway is the kind of promise the
  // rest of this studio is built not to make.
  if (!addSpec) addColBtn.remove();

  root.append(scroll, foot);

  const notify = () => {
    updateSummary();
    if (opts.onChange) opts.onChange(getData());
  };

  function getData() {
    return {
      headers: [...headers],
      // Drop rows the user has emptied rather than exporting blanks.
      rows: rows.filter((r) => r.some((c) => String(c ?? '').trim() !== '')).map((r) => [...r]),
    };
  }

  function updateSummary() {
    const live = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
    const bad = countInvalid();
    summary.textContent = bad
      ? `${live.length} rows · ${bad} cell${bad === 1 ? '' : 's'} to fix`
      : `${live.length} row${live.length === 1 ? '' : 's'} · ${headers.length} columns`;
    summary.className = 'dgrid-summary' + (bad ? ' bad' : '');
  }

  function countInvalid() {
    let n = 0;
    const labelCols = labelCount();
    rows.forEach((r) => {
      // A wholly empty row is a placeholder, not an error.
      if (!r.some((c) => String(c ?? '').trim() !== '')) return;
      for (let c = labelCols; c < headers.length; c++) {
        const v = String(r[c] ?? '').trim();
        if (v !== '' && !looksNumeric(v)) n++;
      }
    });
    return n;
  }

  /** Fill the grid from a pasted block, starting at the given cell. */
  function pasteBlock(text, atRow, atCol) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length);
    const grid = lines.map((l) => (l.includes('\t') ? l.split('\t') : l.split(',')).map((s) => s.trim()));
    grid.forEach((line, r) => {
      const target = atRow + r;
      while (rows.length <= target) rows.push(new Array(headers.length).fill(''));
      line.forEach((cell, c) => {
        const col = atCol + c;
        // Grow the table to fit what was pasted rather than truncating it.
        while (headers.length <= col) {
          headers.push(addSpec ? addSpec.name(headers.length + 1) : `Series ${headers.length}`);
          rows.forEach((rr) => rr.push(''));
        }
        rows[target][col] = cell;
      });
    });
    render();
    notify();
  }

  function render() {
    table.innerHTML = '';
    while (rows.length < minRows) rows.push(new Array(headers.length).fill(''));
    rows.forEach((r) => { while (r.length < headers.length) r.push(''); });
    const labelCols = labelCount();

    /* header row — names are editable, since they become series labels */
    const thead = el('thead');
    const hr = el('tr');
    hr.appendChild(el('th', 'dgrid-gutter', '#'));
    headers.forEach((h, c) => {
      const th = el('th');
      const inp = el('input', 'dgrid-head-input');
      inp.value = h;
      inp.spellcheck = false;
      inp.setAttribute('aria-label', `Name of column ${c + 1}`);
      inp.addEventListener('input', () => { headers[c] = inp.value; notify(); });
      th.appendChild(inp);
      // A text column may go while there are more of them than the shape
      // needs — that is what lets a fourth Sankey stage be taken back out. A
      // value column may go while more than the minimum remain, except on a
      // shape whose last column *is* the amount: removing it there silently
      // promotes a stage to the value and turns its names into bad numbers.
      const isAmount = addSpec && addSpec.stage && c === headers.length - 1;
      const removable = headers.length > rules.minCols && !isAmount
        && (c >= labelCols || labelCols > rules.minText);
      if (removable) {
        const del = el('button', 'dgrid-del', '✕');
        del.type = 'button';
        del.title = 'Remove this column';
        del.addEventListener('click', () => {
          headers.splice(c, 1);
          rows.forEach((rr) => rr.splice(c, 1));
          render(); notify();
        });
        th.appendChild(del);
      }
      hr.appendChild(th);
    });
    hr.appendChild(el('th', 'dgrid-gutter', ''));
    thead.appendChild(hr);
    table.appendChild(thead);

    /* body */
    const tbody = el('tbody');
    rows.forEach((row, r) => {
      const tr = el('tr');
      tr.appendChild(el('td', 'dgrid-gutter', String(r + 1)));

      headers.forEach((_, c) => {
        const td = el('td');
        const inp = el('input', 'dgrid-cell');
        inp.value = row[c] ?? '';
        inp.spellcheck = false;
        inp.dataset.row = r;
        inp.dataset.col = c;
        // Numeric columns get a numeric keypad on phones.
        if (c >= labelCols) inp.setAttribute('inputmode', 'decimal');
        inp.setAttribute('aria-label', `${headers[c]}, row ${r + 1}`);

        const mark = () => {
          const v = String(inp.value).trim();
          const bad = c >= labelCols && v !== '' && !looksNumeric(v);
          inp.classList.toggle('bad', bad);
          inp.title = bad ? 'This is not a number — it will be read as 0' : '';
        };

        inp.addEventListener('input', () => { rows[r][c] = inp.value; mark(); notify(); });
        inp.addEventListener('paste', (e) => {
          const text = (e.clipboardData || window.clipboardData).getData('text');
          if (!text || (!text.includes('\n') && !text.includes('\t'))) return;   // single value: let it through
          e.preventDefault();
          pasteBlock(text, r, c);
        });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const next = table.querySelector(`.dgrid-cell[data-row="${r + 1}"][data-col="${c}"]`);
            if (next) next.focus();
            else { addRow(); setTimeout(() => {
              const n2 = table.querySelector(`.dgrid-cell[data-row="${r + 1}"][data-col="${c}"]`);
              if (n2) n2.focus();
            }, 0); }
          }
        });
        mark();
        td.appendChild(inp);
        tr.appendChild(td);
      });

      const last = el('td', 'dgrid-gutter');
      if (rows.length > minRows) {
        const del = el('button', 'dgrid-del', '✕');
        del.type = 'button';
        del.title = 'Remove this row';
        del.addEventListener('click', () => { rows.splice(r, 1); render(); notify(); });
        last.appendChild(del);
      }
      tr.appendChild(last);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    updateSummary();
  }

  function addRow() {
    rows.push(new Array(headers.length).fill(''));
    render();
    const inp = table.querySelector(`.dgrid-cell[data-row="${rows.length - 1}"][data-col="0"]`);
    if (inp) inp.focus();
    notify();
  }

  addRowBtn.addEventListener('click', addRow);
  addColBtn.addEventListener('click', () => {
    if (!addSpec) return;
    // A stage goes in front of the value column: a path is A → B → C and then
    // the amount, never the amount and then another stage.
    const at = addSpec.stage ? Math.max(labelCount(), headers.length - 1) : headers.length;
    headers.splice(at, 0, addSpec.name(at + 1));
    rows.forEach((r) => r.splice(at, 0, ''));
    render(); notify();
    const inp = table.querySelector(`.dgrid-cell[data-row="0"][data-col="${at}"]`);
    if (inp) inp.focus();
  });

  render();

  return {
    el: root,
    getData,
    setData(next) {
      headers = [...(next.headers || headers)];
      rows = (next.rows || []).map((r) => [...r]);
      render(); updateSummary();
    },
    addRow,
    /** @returns {{ ok: boolean, message: string }} */
    validate() {
      const live = rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
      if (!live.length) return { ok: false, message: 'Add at least one row of data.' };
      const bad = countInvalid();
      if (bad) {
        return { ok: false, message: `${bad} cell${bad === 1 ? '' : 's'} ${bad === 1 ? 'is' : 'are'} not a number. Fix the highlighted cells, or clear them.` };
      }
      // Every column the shape needs filled, not just the first: a flow with
      // no `to` is not a flow, and dropping it silently is how a Sankey ends
      // up missing a ribbon nobody can account for.
      const need = requiredCount();
      const blanks = live.filter((r) => {
        for (let c = 0; c < need; c++) if (!String(r[c] ?? '').trim()) return true;
        return false;
      }).length;
      if (blanks) {
        const rowWord = `${blanks} row${blanks === 1 ? '' : 's'}`;
        return {
          ok: false,
          message: need > 1
            ? `${rowWord} ${blanks === 1 ? 'leaves' : 'leave'} one of the first ${need} columns blank.`
            : `${rowWord} ${blanks === 1 ? 'has' : 'have'} no label in the first column.`,
        };
      }
      return { ok: true, message: `${live.length} row${live.length === 1 ? '' : 's'} ready.` };
    },
  };
}
