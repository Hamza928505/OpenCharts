/**
 * GalleryApp.js — the chart index.
 *
 * Every tile shows the real chart, not a screenshot, rendered from the same
 * definition the studio uses. They are built lazily through an
 * IntersectionObserver and torn down when they scroll well out of view, so the
 * page stays responsive with fifty live charts in the document.
 */

import { CHARTS, CATEGORIES, CATEGORY_ORDER, CHART_COUNT, searchCharts, newSpec, engineTally } from './registry.js';
import { renderChart, destroyInstance, generateCode } from './engines.js';
import { ALL_LIBRARIES } from './cdn.js';
import { mountThemeToggle, onThemeChange } from './theme.js';
import { escapeHtml } from './StudioApp.js';
import { parseTable, applyData } from './dataio.js';
import { chooseDataFile } from './fileimport.js';
import { rankCharts, expectedColumnsFor, handOff } from './DataMatch.js';
import { buildPrompt, readPromptMode } from './prompt.js';
import { toast } from './toast.js';

const PREVIEW_HEIGHT = 132;

/**
 * A column name on one line.
 *
 * A spreadsheet wraps a heading rather than widening the column, and that
 * line break is really in the cell — `Corr H\n(H_real)`. It belongs in the
 * table, which is the reader's own name for the column; it does not belong
 * in a chip that is styled to be one line tall.
 */
const oneLine = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

export class GalleryApp {
  constructor() {
    this.grid = document.querySelector('#grid');
    this.countEl = document.querySelector('#result-count');
    this.searchEl = document.querySelector('#search');
    this.filtersEl = document.querySelector('#filters');
    this.category = 'All';
    this.query = '';
    this.live = new Map();
    /** The table a reader brought, once they bring one. */
    this.table = null;
    /**
     * chart id → the columns of `table` that chart can read, for the charts
     * that cannot read all of them. Absent means it reads the table whole.
     */
    this.projected = new Map();
    this.fit = null;

    this._buildFilters();
    this._buildStats();
    this._buildMatcher();
    this._observer = new IntersectionObserver((entries) => this._onIntersect(entries), {
      root: null,
      rootMargin: '300px 0px',
      threshold: 0,
    });

    mountThemeToggle(document.querySelector('#theme-mount'));
    onThemeChange(() => this._refreshLive());

    this.searchEl.addEventListener('input', () => {
      this.query = this.searchEl.value;
      this.render();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        this.searchEl.focus();
      }
    });

    this.render();
  }

  _buildStats() {
    const host = document.querySelector('#hero-stats');
    if (!host) return;
    const tally = engineTally();
    const stats = [
      { n: CHART_COUNT, l: 'chart types' },
      { n: CATEGORIES.length, l: 'categories' },
      { n: (tally.canvas || 0) + (tally.native || 0) + (tally.dom || 0), l: 'library-free' },
      { n: '5', l: 'ways to export' },
    ];
    host.innerHTML = stats.map((s) =>
      `<div class="hero-stat"><div class="n tnum">${s.n}</div><div class="l">${s.l}</div></div>`).join('');
  }

  /**
   * "I have this table — what can I draw?"
   *
   * Every chart already declares the columns it reads, and `checkTableShape`
   * already answers this for one chart. The panel asks it for all 98 and
   * narrows the gallery to the ones that say yes, which is the question a
   * reader holding a spreadsheet actually has.
   */
  _buildMatcher() {
    const bar = document.querySelector('#matchbar');
    if (!bar) return;

    const toggle = bar.querySelector('#match-toggle');
    const body = bar.querySelector('#match-body');
    const text = bar.querySelector('#match-text');
    const status = bar.querySelector('#match-status');
    const read = bar.querySelector('#match-read');
    const headerBox = bar.querySelector('#match-header');
    this.matchStatus = status;

    // `region,2023,2024` over `North,520,680` cannot be settled by looking at
    // it — the header row is numeric, because the columns are years. So the
    // detection sets the box and the reader gets the final word.
    let headerAnswered = false;

    const setStatus = (msg, tone) => {
      status.textContent = msg;
      status.className = 'match-status' + (tone ? ' ' + tone : '');
    };

    const open = (on) => {
      body.hidden = !on;
      toggle.setAttribute('aria-expanded', String(on));
      toggle.textContent = on ? 'Hide' : 'Match my data';
      if (on) text.focus();
    };

    let timer = null;
    const run = () => {
      const raw = text.value.trim();
      if (!raw) {
        this.table = null;
        this.projected = new Map();
        this.fit = null;
        read.innerHTML = '<p class="dlg-note">Paste something on the left and the gallery '
          + 'below narrows to the charts that can draw it.</p>';
        setStatus('Commas, tabs and semicolons all work.');
        this.render();
        return;
      }

      const table = parseTable(raw, headerAnswered ? headerBox.checked : undefined);
      if (!headerAnswered) headerBox.checked = table.hadHeader;
      if (!table.rows.length) {
        setStatus('Nothing readable in that yet.', 'bad');
        return;
      }

      const ranked = rankCharts(table);
      this.table = table;
      // A chart that cannot read all forty-five of somebody's columns can very
      // often read four of them, and which four is worth keeping: it is what
      // the tile says, what the studio opens on, and what the prompt quotes.
      this.projected = new Map(ranked.partial.map((e) => [e.def.id, e.table]));
      this.fit = new Set([...ranked.fits, ...ranked.partial].map((f) => f.def.id));
      this._renderReading(read, table, ranked);
      const total = this.fit.size;
      setStatus(`${total} of ${CHART_COUNT} charts can read this.`, total ? 'ok' : 'bad');
      this.render();
    };

    text.addEventListener('input', () => {
      clearTimeout(timer);
      // A new table is a new question, so the detection gets to answer again.
      headerAnswered = false;
      timer = setTimeout(run, 220);
    });

    headerBox.addEventListener('change', () => { headerAnswered = true; run(); });

    toggle.addEventListener('click', () => open(body.hidden));

    bar.querySelector('#match-file').addEventListener('click', async () => {
      setStatus('Reading…');
      const res = await chooseDataFile();
      if (!res) { setStatus('No file chosen.'); return; }
      if (!res.ok) { setStatus(res.message, 'bad'); return; }
      text.value = res.text;
      headerAnswered = false;
      open(true);
      run();
    });

    bar.querySelector('#match-clear').addEventListener('click', () => {
      text.value = '';
      headerAnswered = false;
      run();
      text.focus();
    });
  }

  /** What the parser saw, and what it means — shown before any chart list. */
  _renderReading(host, table, ranked) {
    const chips = table.headers.map((h, i) => {
      const role = ranked.shape.roles[i] || 'numbers';
      return `<span class="match-col-chip ${role}"><b>${escapeHtml(oneLine(h))}</b>`
        + `<span>${role}</span></span>`;
    }).join('');

    // The grid below stays grouped by category, so name the categories rather
    // than a "top three" in an order the reader is not about to see.
    const all = [...ranked.fits, ...ranked.partial];
    const groups = [...new Set(all.map((f) => f.def.category))];
    const named = groups.slice(0, 4).join(', ')
      + (groups.length > 4 ? ` and ${groups.length - 4} more` : '');

    // A wide export matches nothing whole and most things in part, so the
    // count that leads is the one answering "what can I draw with this?".
    const verdict = `<p class="match-verdict"><b>${all.length}</b> charts can read this`
      + (groups.length ? ` — ${escapeHtml(named)}.` : '.') + '</p>';

    let advice;
    if (!all.length) {
      advice = 'Nothing here reads a table this shape. Check the delimiter, or whether the '
        + 'first row is a header.';
    } else if (!ranked.partial.length) {
      advice = 'Open any of them below and your table is already in it.';
    } else if (!ranked.fits.length) {
      advice = `No chart reads all ${table.headers.length} of your columns — none reads that `
        + 'many. Each tile below names the ones it takes, and opens on those.';
    } else {
      advice = `<b>${ranked.fits.length}</b> read the table whole; the other `
        + `<b>${ranked.partial.length}</b> read some of its columns, named on each tile.`;
    }

    host.innerHTML =
      `<p class="match-shape">${escapeHtml(ranked.shape.summary)}</p>`
      + `<div class="match-cols">${chips}</div>`
      + verdict
      + `<p class="dlg-note" style="margin-top:.4rem">${advice}</p>`
      // Dropping rows in silence would be worse than not dropping them: a
      // reader who cannot find their first row should be told where it went.
      + (table.skipped
        ? `<p class="dlg-note" style="margin-top:.4rem">Skipped <b>${table.skipped}</b> `
          + `row${table.skipped === 1 ? '' : 's'} of title above the table.</p>`
        : '')
      // Years make a header row indistinguishable from data, so when the guess
      // came out "no header" the way to correct it is named rather than left
      // for the reader to find.
      + (table.hadHeader ? '' :
        '<p class="dlg-note" style="margin-top:.4rem">No header row was detected, so the '
        + 'columns above were named for you. Tick <b>First row is a header</b> if it is one.</p>');
  }

  /**
   * The table this chart gets — the whole thing, or the columns it can read.
   *
   * One answer for the three surfaces that hand data to a chart: the tile's
   * caption, the handoff to the studio, and the AI prompt. Left to themselves
   * they would be free to disagree about which columns the reader was shown.
   */
  _tableFor(def) {
    return this.projected.get(def.id) || this.table;
  }

  _buildFilters() {
    const all = ['All', ...CATEGORY_ORDER.filter((c) => CHARTS.some((x) => x.category === c))];
    this.filtersEl.innerHTML = '';
    all.forEach((name) => {
      const b = document.createElement('button');
      b.className = 'filter' + (name === 'All' ? ' active' : '');
      b.type = 'button';
      b.textContent = name;
      b.addEventListener('click', () => {
        this.category = name;
        this.filtersEl.querySelectorAll('.filter').forEach((x) => x.classList.toggle('active', x === b));
        this.render();
      });
      this.filtersEl.appendChild(b);
    });
  }

  render() {
    // Drop every live preview before the DOM under it disappears.
    this.live.forEach((inst) => destroyInstance(inst));
    this.live.clear();
    this._observer.disconnect();
    this.grid.innerHTML = '';

    let matches = searchCharts(this.query, this.category);
    if (this.fit) matches = matches.filter((c) => this.fit.has(c.id));
    this.countEl.textContent = `${matches.length} of ${CHART_COUNT}`;

    if (!matches.length) {
      this.grid.innerHTML = this.fit
        ? '<div class="empty"><div class="display">Nothing in this category</div>'
          + '<p>No chart here reads a table that shape. Try All, or clear the table.</p></div>'
        : '<div class="empty"><div class="display">Nothing here</div>'
          + '<p>No chart matches that search. Try a shape — "stacked", "radial", "flow".</p></div>';
      return;
    }

    if (this.fit) this.grid.appendChild(this._matchNote(matches.length));

    // Group under category rules unless the user is actively searching, where a
    // flat relevance-free list reads better than eight one-item sections.
    const grouped = !this.query.trim();
    if (grouped) {
      CATEGORIES.forEach((group) => {
        const inGroup = matches.filter((c) => c.category === group.name);
        if (!inGroup.length) return;
        this.grid.appendChild(sectionRule(group.name, inGroup.length));
        inGroup.forEach((c) => this.grid.appendChild(this._card(c)));
      });
    } else {
      matches.forEach((c) => this.grid.appendChild(this._card(c)));
    }
  }

  /** Says the grid is filtered, and how to stop — a filter with no way out is a trap. */
  _matchNote(count) {
    const note = document.createElement('div');
    note.className = 'match-note';
    note.innerHTML = `<span>Showing the <b>${count}</b> charts that can read your table.</span>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm';
    btn.type = 'button';
    btn.textContent = 'Show all charts';
    btn.addEventListener('click', () => {
      this.table = null;
      this.projected = new Map();
      this.fit = null;
      const text = document.querySelector('#match-text');
      if (text) text.value = '';
      if (this.matchStatus) this.matchStatus.textContent = 'Commas, tabs and semicolons all work.';
      this.render();
    });
    note.appendChild(btn);
    return note;
  }

  _card(def) {
    // The tile is a link, and a link may not contain a button — so the button
    // is the link's sibling inside a shell, not a child of it. That also keeps
    // it clear of the anchor's own mousedown/click handoff handlers below.
    const shell = document.createElement('div');
    shell.className = 'card-shell';

    const card = document.createElement('a');
    card.className = 'card';
    card.href = `studio.html?chart=${encodeURIComponent(def.id)}`;

    // A table is too big for a URL, so it travels in session storage and the
    // studio takes it on arrival. Set on mousedown as well as click so a
    // middle-click or a new tab carries it too.
    if (this.table) {
      const carry = () => handOff(this._tableFor(def));
      card.addEventListener('mousedown', carry);
      card.addEventListener('click', carry);
    }

    const canvas = document.createElement('div');
    canvas.className = 'card-canvas';
    canvas.dataset.id = def.id;
    const skeleton = document.createElement('div');
    skeleton.className = 'card-skeleton';
    canvas.appendChild(skeleton);

    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML =
      `<div class="card-title">${escapeHtml(def.title)}</div>`
      + `<p class="card-blurb">${escapeHtml(def.blurb)}</p>`
      + `<div class="card-foot">`
      + `<span class="pill chip-engine ${def.engineChip}">${escapeHtml(def.engineLabel)}</span>`
      + `<span class="card-open">Open<span aria-hidden="true">→</span></span>`
      + `</div>`;

    // When a table is loaded, say what this chart will make of its columns —
    // the reader's own column names wherever only some of them are read, since
    // naming the example's instead would promise a table they have not got.
    if (this.table) {
      const slice = this.projected.get(def.id);
      const cols = (slice ? slice.headers : expectedColumnsFor(def)).map(oneLine);
      if (cols.length) {
        const fit = document.createElement('div');
        fit.className = 'card-fit' + (slice ? ' part' : '');
        fit.textContent = 'reads ' + cols.join(', ');
        fit.title = cols.join(', ');
        body.appendChild(fit);
      }
    }

    card.append(canvas, body);

    const prompt = document.createElement('button');
    prompt.className = 'card-prompt';
    prompt.type = 'button';
    prompt.title = 'Copy a prompt for this chart — paste it into any AI along with your own spreadsheet';
    prompt.setAttribute('aria-label', `Copy an AI prompt for ${def.title}`);
    prompt.innerHTML = '<span aria-hidden="true">⧉</span> Prompt';
    prompt.addEventListener('click', () => this._copyPrompt(def, prompt));

    shell.append(card, prompt);
    this._observer.observe(canvas);
    return shell;
  }

  /**
   * Copy this chart's AI brief without opening it.
   *
   * Built on the click rather than with the tile: a prompt carries the whole
   * standalone export, and generating ninety-eight of them to fill a grid
   * nobody has clicked yet would cost more than the entire page does.
   */
  async _copyPrompt(def, btn) {
    const label = btn.innerHTML;
    try {
      const spec = newSpec(def);
      // A reader who pasted a table meant that data — the same thing opening
      // the tile does with it. A table this chart cannot read leaves the
      // example in place rather than half-applying it.
      if (this.table) {
        const res = applyData(def, spec, this._tableFor(def));
        if (res.ok && typeof def.onChange === 'function') def.onChange(spec);
      }
      // Whichever kind the reader last asked for in the studio. One choice
      // answers for both surfaces, and the toast says which arrived.
      const mode = readPromptMode();
      const text = buildPrompt(def, spec, generateCode(def, spec), mode);
      await navigator.clipboard.writeText(text);

      btn.innerHTML = '<span aria-hidden="true">✓</span> Copied';
      btn.classList.add('ok');
      setTimeout(() => { btn.innerHTML = label; btn.classList.remove('ok'); }, 1800);
      const what = mode === 'data' ? 'data-only prompt' : 'prompt';
      toast(this.table
        ? `${def.title} ${what} copied — it carries your table`
        : `${def.title} ${what} copied — paste it into any AI with your data`, 'ok');
    } catch {
      // Clipboard access needs a secure context, and there is no text node to
      // fall back on selecting here the way the code panel has.
      toast('Could not copy the prompt — open the chart and use the AI Prompt tab', 'bad');
    }
  }

  _onIntersect(entries) {
    entries.forEach((entry) => {
      const host = entry.target;
      const id = host.dataset.id;
      if (entry.isIntersecting) {
        if (this.live.has(id)) return;
        this._mount(host, id);
      } else if (this.live.has(id)) {
        // Far off-screen: free the chart but keep the tile in place.
        destroyInstance(this.live.get(id));
        this.live.delete(id);
        host.innerHTML = '<div class="card-skeleton"></div>';
      }
    });
  }

  /**
   * The spec a tile draws: the reader's own data where they brought some, the
   * chart's example otherwise.
   *
   * A grid that says "these ninety charts can read your table" and then draws
   * ninety charts of somebody else's numbers is answering a question nobody
   * asked. The columns are the ones the tile names, so what is previewed, what
   * opens in the studio and what the prompt quotes are one table.
   *
   * Two things it has to get right:
   *
   *   - **A fresh clone per tile.** `applyData` writes into the spec it is
   *     given and `onChange` normalises it in place, so a shared one would let
   *     one chart's idea of the data reach the next.
   *   - **A chart that cannot take the table keeps its example.** A spec that
   *     was half written before the read failed draws worse than the example
   *     it replaced, and a blank tile in a grid of ninety says nothing about
   *     which chart went wrong.
   */
  _specFor(def) {
    const table = this.table && this._tableFor(def);
    if (!table) return newSpec(def);
    const spec = newSpec(def);
    try {
      const res = applyData(def, spec, table);
      if (!res.ok) return newSpec(def);
      if (typeof def.onChange === 'function') def.onChange(spec);
      return spec;
    } catch {
      return newSpec(def);
    }
  }

  _mount(host, id) {
    const def = CHARTS.find((c) => c.id === id);
    if (!def) return;
    // Yield a frame so a fast scroll does not build charts it will discard.
    requestAnimationFrame(() => {
      if (!host.isConnected) return;
      try {
        const inst = renderChart(def, host, this._specFor(def),
          { height: PREVIEW_HEIGHT, compact: true });
        this.live.set(id, inst);
      } catch (err) {
        host.innerHTML = `<div style="font-size:11px;color:var(--ink-faint);text-align:center;padding:1rem">${escapeHtml(err.message)}</div>`;
      }
    });
  }

  _refreshLive() {
    const ids = [...this.live.keys()];
    ids.forEach((id) => {
      const host = this.grid.querySelector(`.card-canvas[data-id="${CSS.escape(id)}"]`);
      destroyInstance(this.live.get(id));
      this.live.delete(id);
      if (host) this._mount(host, id);
    });
  }
}

/**
 * The credits footer: every third-party library the project ships, generated
 * from the same table the studio and the exports read, so the list can never
 * quietly fall out of date.
 */
export function renderCredits(libsHost, tallyHost) {
  if (libsHost) {
    libsHost.innerHTML = '';
    ALL_LIBRARIES.forEach((lib) => {
      const row = document.createElement('div');
      row.className = 'foot-lib';
      row.innerHTML =
        `<div class="foot-lib-head">`
        + `<a href="${escapeHtml(lib.homepage)}" target="_blank" rel="noopener noreferrer">${escapeHtml(lib.name)}</a>`
        + `<span class="pill">${escapeHtml(lib.version)}</span>`
        + `<span class="pill">${escapeHtml(lib.license)}</span>`
        + `</div>`
        + `<p class="foot-lib-role">${escapeHtml(lib.role)}</p>`
        + `<code class="foot-lib-url" title="${escapeHtml(lib.url)}">${escapeHtml(lib.url)}</code>`;
      libsHost.appendChild(row);
    });
  }

  if (tallyHost) {
    const t = engineTally();
    const free = (t.canvas || 0) + (t.native || 0) + (t.dom || 0);
    tallyHost.textContent =
      `${CHART_COUNT} charts · ${ALL_LIBRARIES.length} libraries · ${free} need no library at all`;
  }
}

function sectionRule(name, count) {
  const el = document.createElement('div');
  el.className = 'section-rule';
  el.innerHTML =
    `<h2>${escapeHtml(name)}</h2><span class="line"></span><span class="n">${count}</span>`;
  return el;
}
