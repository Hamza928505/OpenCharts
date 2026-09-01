/**
 * DataDialog.js — where data actually gets entered.
 *
 * Three ways in, one source of truth. The grid holds `{ headers, rows }`; the
 * pickers append to it; the paste tab parses into it. "Use this data" then
 * serialises that back to CSV and hands it to the same `applyData` the sidebar
 * uses, so there is exactly one parsing path to reason about.
 *
 * The grid leads because typing a table into a textarea is the worst part of
 * the old flow: no structure, no feedback until you commit, and one missing
 * comma silently shifts a whole row.
 */

import {
  parseTable, applyData, toCSV, looksNumeric, expectedFormat, columnRules, countOf,
} from './dataio.js';
import { createDataGrid } from './DataGrid.js';
import { createCombobox } from './Combobox.js';
import { createCheckList } from './CheckList.js';
import {
  loadCountries, loadCities, countryItems, findCountryEntry, localCityName,
} from './geodata.js';
import { flagIcon } from './flags.js';
import { applyOrigin } from './motion.js';
import { ask } from './confirm.js';
import { readDataFile, readDataUrl, ACCEPTED } from './fileimport.js';
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
 * @param {string} [seedText] open on this table instead of the chart's current
 *   one — how a file that did not match its chart gets handed over for fixing
 */
export function openDataDialog(def, spec, onApply, seedText) {
  const desc = def.data || {};
  const picker = desc.picker || null;   // 'cities' | 'countries' | null

  // The chart's own column names, so a table that holds no numbers at all —
  // an edge list — still has its header row recognised as one.
  const expectedCols = expectedFormat(def).columns;
  // How many leading columns hold words rather than numbers. Flagging
  // "Berlin" as a bad number would be worse than not validating at all, and
  // on a flow this grows with the table: every column but the last is a stage.
  const labelColumnsFor = (headers) => countOf(columnRules(desc.shape).text, headers);

  /* ── shell ──────────────────────────────────────────────────────────── */

  const scrim = el('div', 'dlg-scrim');
  const dlg = el('div', 'dlg');
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.setAttribute('aria-label', 'Edit chart data');

  const head = el('div', 'dlg-head');
  const titles = el('div');
  titles.appendChild(el('h2', 'dlg-title', 'Your data'));
  titles.appendChild(el('p', 'dlg-sub', `${def.title} — ${desc.hint || 'Fill in the table below.'}`));
  const close = el('button', 'dlg-close', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  head.append(titles, close);

  const tabs = el('div', 'dlg-tabs');
  tabs.setAttribute('role', 'tablist');
  const panels = el('div', 'dlg-panels');

  const foot = el('div', 'dlg-foot');
  const status = el('span', 'dlg-status');
  const resetBtn = el('button', 'btn', 'Load example');
  resetBtn.type = 'button';
  const cancel = el('button', 'btn', 'Cancel');
  cancel.type = 'button';
  const apply = el('button', 'btn btn-primary', 'Use this data');
  apply.type = 'button';
  foot.append(status, resetBtn, cancel, apply);

  dlg.append(head, tabs, panels, foot);
  scrim.appendChild(dlg);
  document.body.appendChild(scrim);
  // After it is in the document, because the origin is a share of the
  // dialog's own box and an unmounted element has no box to measure.
  applyOrigin(dlg);

  /* ── initial table ──────────────────────────────────────────────────── */

  const currentText = typeof def.toText === 'function' ? def.toText(spec) : '';
  const fromChart = !(seedText && seedText.trim()) && !!(currentText && currentText.trim());
  const startText = seedText && seedText.trim()
    ? seedText
    : (currentText && currentText.trim() ? currentText : (desc.example || ''));
  // A table this chart wrote itself has a header by construction. A table
  // handed over from a file does not, so that one still has to be worked out.
  const start = parseTable(startText, fromChart ? true : expectedCols);

  const grid = createDataGrid({
    headers: start.headers.length ? start.headers : ['Label', 'Value'],
    rows: start.rows,
    shape: desc.shape,
    minRows: 1,
    onChange: () => { status.textContent = ''; status.className = 'dlg-status'; },
  });

  /* ── tabs ───────────────────────────────────────────────────────────── */

  const panelFor = {};
  const tabFor = {};
  let activeTab = 'grid';

  const onEnter = {};

  function addTab(id, label, node, enter) {
    const b = el('button', 'dlg-tab', label);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => select(id));
    tabs.appendChild(b);
    const panel = el('div', 'dlg-panel');
    panel.appendChild(node);
    panels.appendChild(panel);
    tabFor[id] = b;
    panelFor[id] = panel;
    if (enter) onEnter[id] = enter;
  }

  function select(id) {
    // Leaving the paste tab commits whatever is in it, so a user who pastes
    // and then clicks "Table" does not silently lose the paste.
    if (activeTab === 'paste' && id !== 'paste') commitPaste();
    activeTab = id;
    Object.entries(tabFor).forEach(([k, b]) => {
      const on = k === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      panelFor[k].classList.toggle('active', on);
    });
    if (id === 'paste') {
      const data = grid.getData();
      pasteArea.value = toCSV(data.headers, data.rows);
      pasteEdited = false;
      refreshPastePreview();
    }
    if (onEnter[id]) onEnter[id]();
  }

  /* Tab 1 — the grid */
  const gridPanel = el('div', 'dlg-gridwrap');
  gridPanel.appendChild(grid.el);
  const gridNote = el('p', 'dlg-note');
  gridNote.innerHTML =
    'Click a cell and type. <kbd>Tab</kbd> moves across, <kbd>Enter</kbd> moves down. '
    + 'You can paste a block straight from Excel or Sheets into any cell — it fills from there.';
  gridPanel.appendChild(gridNote);
  addTab('grid', 'Table', gridPanel);

  /* Tab 2 — the place pickers */
  let refreshPickList = null;
  if (picker) {
    addTab('pick', picker === 'cities' ? 'Pick cities' : 'Pick countries',
      buildPicker(), () => refreshPickList && refreshPickList());
  }

  /* Tab 3 — paste */
  const pastePanel = el('div', 'dlg-body');
  const leftCol = el('div', 'dlg-col');
  leftCol.appendChild(el('label', 'dlg-label', 'Paste a table'));
  const pasteArea = el('textarea', 'dlg-paste');
  pasteArea.spellcheck = false;
  pasteArea.setAttribute('aria-label', 'Chart data as text');
  const pasteTools = el('div', 'dlg-tools');
  const useBtn = el('button', 'btn btn-sm', 'Read into the table');
  useBtn.type = 'button';
  const rowCount = el('span', 'dlg-rowcount');
  pasteTools.append(useBtn, rowCount);
  leftCol.append(pasteArea, pasteTools);

  const rightCol = el('div', 'dlg-col');
  rightCol.appendChild(el('label', 'dlg-label', 'What OpenCharts reads'));
  const preview = el('div', 'dlg-preview');
  rightCol.appendChild(preview);
  const formatNote = el('p', 'dlg-note');
  formatNote.innerHTML =
    'Commas, tabs and semicolons all work. A header row is detected automatically, '
    + 'and <code>1,234</code>, <code>$99</code> and <code>42%</code> are all read as numbers.';
  rightCol.appendChild(formatNote);
  pastePanel.append(leftCol, rightCol);
  addTab('paste', 'Paste text', pastePanel);

  /* Tab 4 — a file straight off disk */
  addTab('file', 'Open a file', buildFileTab());
  addTab('link', 'From a link', buildLinkTab());

  /* ── the paste tab ──────────────────────────────────────────────────── */

  // The paste tab opens on the grid's own CSV. Until somebody edits it, its
  // header row is still the grid's and does not need detecting; after that it
  // is a paste like any other.
  let pasteEdited = false;

  function commitPaste() {
    const t = parseTable(pasteArea.value, pasteEdited ? expectedCols : true);
    if (!t.rows.length) return;
    grid.setData({ headers: t.headers, rows: t.rows });
  }

  function refreshPastePreview() {
    const table = parseTable(pasteArea.value, pasteEdited ? expectedCols : true);
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
    const labelCols = labelColumnsFor(table.headers);
    table.headers.forEach((h, i) => {
      const th = el('th', null, h);
      th.appendChild(el('span', 'dlg-role', i < labelCols ? 'labels' : 'values'));
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
        // note, a merged cell — before it is applied rather than after.
        const unreadable = i >= labelCols && cell !== '' && !looksNumeric(cell);
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
        'No header row was detected, so the columns were named for you.'));
    }
  }

  pasteArea.addEventListener('input', () => { pasteEdited = true; refreshPastePreview(); });
  useBtn.addEventListener('click', () => { commitPaste(); select('grid'); toast('Read into the table', 'ok'); });

  /* ── opening a file ─────────────────────────────────────────────────── */

  function buildFileTab() {
    const wrap = el('div', 'pick');

    wrap.appendChild(el('p', 'dlg-note',
      'Open a spreadsheet or a text table. Nothing is uploaded — the file is '
      + 'read in this browser and never sent anywhere.'));

    const zone = el('div', 'drop');
    zone.setAttribute('role', 'button');
    zone.tabIndex = 0;
    const zoneMain = el('p', 'drop-main', 'Drop a file here, or click to choose one');
    const zoneSub = el('p', 'drop-sub', '.xlsx · .csv · .tsv · .txt — up to 10MB');
    zone.append(zoneMain, zoneSub);

    const input = el('input');
    input.type = 'file';
    input.accept = ACCEPTED;
    input.style.display = 'none';

    const status = el('p', 'dlg-note file-status');

    const take = async (file) => {
      if (!file) return;
      zone.classList.remove('over');
      status.className = 'dlg-note file-status';
      status.textContent = 'Reading ' + file.name + '…';

      const res = await readDataFile(file);
      if (!res.ok) {
        status.textContent = '';
        await ask({ title: 'That file could not be read', text: res.message, tone: 'stop', confirm: 'OK' });
        return;
      }

      const table = parseTable(res.text, expectedCols);
      if (!table.rows.length) {
        status.textContent = '';
        await ask({
          title: 'Nothing to read in that file',
          text: 'It opened, but no rows came out of it.',
          tone: 'stop', confirm: 'OK',
        });
        return;
      }

      // Straight into the grid, where it can be checked and corrected before
      // it reaches the chart — the same place a paste lands.
      grid.setData({ headers: table.headers, rows: table.rows });
      status.className = 'dlg-note file-status ok';
      status.textContent = `Read ${table.rows.length} row${table.rows.length === 1 ? '' : 's'} `
        + `and ${table.headers.length} column${table.headers.length === 1 ? '' : 's'} from `
        + `${file.name} (${res.kind}). Check it in the Table tab.`;
      toast('Opened ' + file.name, 'ok');
      select('grid');
    };

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => {
      take(input.files && input.files[0]);
      // Clear it, or choosing the same file twice in a row does nothing.
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach((evt) => zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add('over');
    }));
    ['dragleave', 'dragend'].forEach((evt) => zone.addEventListener(evt, () => zone.classList.remove('over')));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });

    wrap.append(zone, input, status);

    const note = el('p', 'dlg-note');
    note.innerHTML =
      'The first sheet of a workbook is read, using each cell\'s stored value — '
      + 'formulas are never run. Old <code>.xls</code> files are not supported; '
      + 'save them as <code>.xlsx</code> or <code>.csv</code> first.';
    wrap.appendChild(note);

    return wrap;
  }

  /**
   * The place picker.
   *
   * Cities mode is two steps: choose a country, then tick as many of its
   * cities as you want. The list appears as soon as a country is chosen —
   * which is the point, since nobody knows the spelling of every city in a
   * country they are charting.
   *
   * Countries mode is one step: the same list, of countries.
   */
  function buildPicker() {
    const wrap = el('div', 'pick');
    const isCities = picker === 'cities';

    wrap.appendChild(el('p', 'dlg-note', isCities
      ? 'Choose a country and its cities are listed below. Tick as many as you '
        + 'want, add them in one go, then type the values in the table.'
      : 'Tick as many countries as you want. The spellings the map expects are '
        + 'filled in for you.'));

    /* ── country ──────────────────────────────────────────────────────── */

    let countryBox = null;
    let countries = [];
    let cities = [];
    let chosenIso = '';

    const setPlaceholder = (box, text) => {
      const input = box.el.querySelector('.cbx-input');
      if (input) input.placeholder = text;
    };

    if (isCities) {
      const row = el('div', 'pick-row');
      const field = el('div', 'pick-field pick-country');
      field.appendChild(el('label', 'dlg-label', 'Country'));
      countryBox = createCombobox({
        items: [],
        placeholder: 'Loading countries…',
        emptyText: 'No country by that name',
        renderIcon: (iso2) => flagIcon(iso2),
        onSelect: (name, item) => chooseCountry(item),
      });
      field.appendChild(countryBox.el);
      row.appendChild(field);
      wrap.appendChild(row);
    }

    /* ── the list ─────────────────────────────────────────────────────── */

    const listLabel = el('label', 'dlg-label pick-list-label',
      isCities ? 'Cities' : 'Countries');
    wrap.appendChild(listLabel);

    const list = createCheckList({
      placeholder: isCities ? 'Search cities…' : 'Search countries…',
      emptyText: isCities ? 'Choose a country first.' : 'Loading…',
      // Only the country list sets an `icon`; the city rows leave it empty,
      // since one country's flag repeated down every row says nothing.
      renderIcon: (iso2) => flagIcon(iso2),
      onChange: () => { addBtn.disabled = !list.count(); refreshAddLabel(); },
    });
    wrap.appendChild(list.el);

    /* ── add ──────────────────────────────────────────────────────────── */

    const actions = el('div', 'pick-actions');
    const addBtn = el('button', 'btn btn-primary', 'Add selected');
    addBtn.type = 'button';
    addBtn.disabled = true;
    actions.appendChild(addBtn);

    const pickStatus = el('span', 'dlg-note pick-status');
    actions.appendChild(pickStatus);
    wrap.appendChild(actions);

    const refreshAddLabel = () => {
      const n = list.count();
      addBtn.textContent = n ? `Add ${n} selected` : 'Add selected';
    };

    /* What is already in the table, so adding forty cities still feels like
     * forty additions rather than forty keystrokes into a void. */
    const listBox = el('div', 'pick-list');
    wrap.appendChild(listBox);

    // Places carry three columns before the value; regions carry one.
    const valueColumn = (headers) => Math.min(isCities ? 3 : 1, headers.length - 1);

    refreshPickList = function renderPickList() {
      const data = grid.getData();
      listBox.innerHTML = '';
      if (!data.rows.length) {
        listBox.appendChild(el('p', 'dlg-note', isCities
          ? 'No cities yet. Tick some above and they will appear here.'
          : 'No countries yet. Tick some above and they will appear here.'));
        return;
      }
      listBox.appendChild(el('p', 'dlg-label', `In the table — ${data.rows.length}`));
      const chips = el('div', 'pick-chips');
      const vc = valueColumn(data.headers);
      data.rows.forEach((r, i) => {
        const chip = el('div', 'pick-chip');
        chip.appendChild(el('span', 'pick-chip-name', String(r[0] || '—')));
        const v = String(r[vc] ?? '').trim();
        // `blank`, not `empty`: `.empty` is the gallery's no-results state and
        // carries 4rem of padding, which turned every valueless chip into an
        // ellipse. A component modifier must not be a bare site-wide word.
        chip.appendChild(el('span', 'pick-chip-val' + (v ? '' : ' blank'), v || 'no value'));
        const x = el('button', 'pick-chip-x', '✕');
        x.type = 'button';
        x.title = `Remove ${r[0]}`;
        x.addEventListener('click', () => {
          const d = grid.getData();
          grid.setData({ headers: d.headers, rows: d.rows.filter((_, k) => k !== i) });
          renderPickList();
          pickStatus.textContent = `Removed ${r[0]}.`;
          pickStatus.className = 'dlg-note pick-status';
        });
        chip.appendChild(x);
        chips.appendChild(chip);
      });
      listBox.appendChild(chips);
    };
    refreshPickList();

    /* ── loading ──────────────────────────────────────────────────────── */

    loadCountries().then((all) => {
      countries = all;
      const items = countryItems(all, { onlyWithCities: isCities });

      if (isCities) {
        countryBox.setItems(items);
        setPlaceholder(countryBox, `Search ${items.length} countries…`);
        // Start on whatever the chart is already focused on. This is the
        // "if the chosen country is in the chart, list its cities" case: the
        // reader should not have to tell us twice.
        const opts = spec.opts || {};
        const already = (opts.countries && opts.countries[0]) || opts.country || spec.country;
        const hit = already ? findCountryEntry(all, already) : null;
        if (hit) {
          countryBox.setValue(hit.name);
          chooseCountry({ value: hit.name, iso2: hit.iso2 });
        }
      } else {
        // The note is dropped — a city count is the combobox's business, not
        // this list's — but the flag and the local name are kept.
        list.setItems(items.map((c) => ({
          value: c.value, label: c.label, icon: c.icon, sub: c.sub, search: c.search,
        })));
        // Countries already in the table start ticked, so the list reads as
        // the state of the chart rather than a blank form.
        const have = new Set(grid.getData().rows.map((r) => String(r[0]).trim()));
        list.setSelected(items.filter((c) => have.has(c.value)).map((c) => c.value));
        refreshAddLabel();
        addBtn.disabled = !list.count();
      }
    }).catch(() => {
      pickStatus.textContent = 'The place list could not be loaded. The Table and Paste tabs still work.';
      pickStatus.className = 'dlg-note pick-status bad';
    });

    function chooseCountry(item) {
      chosenIso = item.iso2 || (countries.find((c) => c.name === item.value) || {}).iso2 || '';
      list.setItems([]);
      listLabel.textContent = `Cities in ${item.value}`;
      loadCities(chosenIso).then((all) => {
        cities = all;
        list.setItems(all.map((c) => {
          const local = localCityName(chosenIso, c.name);
          return {
            value: c.name,
            label: c.name,
            sub: local,
            search: local ? `${c.name} ${local}` : c.name,
          };
        }));
        // Cities already in the table start ticked, for the same reason.
        const have = new Set(grid.getData().rows.map((r) => String(r[0]).trim()));
        list.setSelected(all.filter((c) => have.has(c.name)).map((c) => c.name));
        refreshAddLabel();
        addBtn.disabled = !list.count();
        list.focus();
      });
    }

    /* ── adding ───────────────────────────────────────────────────────── */

    addBtn.addEventListener('click', async () => {
      const picked = list.getSelected();
      if (!picked.length) return;

      const data = grid.getData();
      let headers = data.headers;
      // Only impose the place columns when the table is narrower than a place
      // needs; a pasted table may already have its own shape.
      if (isCities && headers.length < 4) headers = ['city', 'lon', 'lat', 'value'];
      if (!isCities && headers.length < 2) headers = ['country', 'value'];

      const have = new Map(data.rows.map((r, i) => [String(r[0]).trim(), i]));
      const rows = data.rows.map((r) => [...r]);
      let added = 0;
      let kept = 0;

      picked.forEach((name) => {
        if (have.has(name)) { kept++; return; }      // already there, value intact
        const row = isCities
          ? (() => {
            const city = cities.find((c) => c.name === name);
            return city ? [city.name, String(city.lon), String(city.lat), ''] : null;
          })()
          : [name, ''];
        if (!row) return;
        while (row.length < headers.length) row.push('');
        rows.push(row.slice(0, headers.length));
        added++;
      });

      // Unticking is a removal: the list is the state of the table, not a
      // one-way inbox, or there would be no way to take a city back out.
      const pickedSet = new Set(picked);
      const universe = new Set((isCities ? cities.map((c) => c.name) : countries.map((c) => c.name)));
      const trimmed = rows.filter((r) => {
        const name = String(r[0]).trim();
        return !universe.has(name) || pickedSet.has(name);
      });
      const removed = rows.length - trimmed.length;

      grid.setData({ headers, rows: trimmed });
      refreshPickList();

      const parts = [];
      if (added) parts.push(`added ${added}`);
      if (kept) parts.push(`${kept} already there`);
      if (removed) parts.push(`removed ${removed}`);
      pickStatus.textContent = parts.length
        ? parts.join(', ') + '. Type the values in the Table tab.'
        : 'Nothing changed.';
      pickStatus.className = 'dlg-note pick-status ok';
      if (added) toast(`${added} added`, 'ok');
    });

    return wrap;
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

  async function doApply() {
    if (activeTab === 'paste') commitPaste();

    const check = grid.validate();
    if (!check.ok) {
      const proceed = await ask({
        title: 'This table has problems',
        text: check.message,
        tone: 'stop',
        confirm: 'Use it anyway',
        cancel: 'Let me fix it',
      });
      if (!proceed) { select('grid'); return; }
    }

    const res = applyData(def, spec, grid.getData());
    if (!res.ok) {
      status.textContent = res.message;
      status.className = 'dlg-status bad';
      return;
    }
    toast(res.message, 'ok');
    onApply(res.message);
    dismiss();
  }

  resetBtn.addEventListener('click', async () => {
    const yes = await ask({
      title: 'Replace the table with the example?',
      text: 'Everything currently in the table will be discarded.',
      tone: 'warn',
      confirm: 'Replace it',
      cancel: 'Keep my data',
    });
    if (!yes) return;
    const ex = parseTable(desc.example || '', true);
    grid.setData({ headers: ex.headers, rows: ex.rows });
    select('grid');
  });

  apply.addEventListener('click', doApply);
  cancel.addEventListener('click', dismiss);
  close.addEventListener('click', dismiss);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) dismiss(); });
  document.addEventListener('keydown', onKey);

  pasteArea.value = startText;
  select('grid');
}
