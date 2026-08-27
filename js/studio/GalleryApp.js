/**
 * GalleryApp.js — the chart index.
 *
 * Every tile shows the real chart, not a screenshot, rendered from the same
 * definition the studio uses. They are built lazily through an
 * IntersectionObserver and torn down when they scroll well out of view, so the
 * page stays responsive with fifty live charts in the document.
 */

import { CHARTS, CATEGORIES, CATEGORY_ORDER, CHART_COUNT, searchCharts, newSpec, engineTally } from './registry.js';
import { renderChart, destroyInstance } from './engines.js';
import { ALL_LIBRARIES } from './cdn.js';
import { mountThemeToggle, onThemeChange } from './theme.js';
import { escapeHtml } from './StudioApp.js';
import { parseTable } from './dataio.js';
import { chooseDataFile } from './fileimport.js';
import { rankCharts, expectedColumnsFor, handOff } from './DataMatch.js';

const PREVIEW_HEIGHT = 132;

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
      { n: '4', l: 'code formats' },
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
      this.fit = new Set(ranked.fits.map((f) => f.def.id));
      this._renderReading(read, table, ranked);
      setStatus(`${ranked.fits.length} of ${CHART_COUNT} charts can read this.`, 'ok');
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
      return `<span class="match-col-chip ${role}"><b>${escapeHtml(h)}</b><span>${role}</span></span>`;
    }).join('');

    // The grid below stays grouped by category, so name the categories rather
    // than a "top three" in an order the reader is not about to see.
    const groups = [...new Set(ranked.fits.map((f) => f.def.category))];
    const named = groups.slice(0, 4).join(', ')
      + (groups.length > 4 ? ` and ${groups.length - 4} more` : '');
    host.innerHTML =
      `<p class="match-shape">${escapeHtml(ranked.shape.summary)}</p>`
      + `<div class="match-cols">${chips}</div>`
      + `<p class="match-verdict"><b>${ranked.fits.length}</b> charts can read this`
      + (groups.length ? ` — ${escapeHtml(named)}.` : '.')
      + `</p>`
      + (ranked.fits.length
        ? '<p class="dlg-note" style="margin-top:.4rem">Open any of them below and your table '
          + 'is already in it.</p>'
        : '<p class="dlg-note" style="margin-top:.4rem">Nothing reads a table this shape. '
          + 'Check the delimiter, or whether the first row is a header.</p>')
      // Years make a header row indistinguishable from data, so when the guess
      // came out "no header" the way to correct it is named rather than left
      // for the reader to find.
      + (table.hadHeader ? '' :
        '<p class="dlg-note" style="margin-top:.4rem">No header row was detected, so the '
        + 'columns above were named for you. Tick <b>First row is a header</b> if it is one.</p>');
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
    const card = document.createElement('a');
    card.className = 'card';
    card.href = `studio.html?chart=${encodeURIComponent(def.id)}`;

    // A table is too big for a URL, so it travels in session storage and the
    // studio takes it on arrival. Set on mousedown as well as click so a
    // middle-click or a new tab carries it too.
    if (this.table) {
      const carry = () => handOff(this.table);
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

    // When a table is loaded, say what this chart will make of its columns.
    if (this.table) {
      const cols = expectedColumnsFor(def);
      if (cols.length) {
        const fit = document.createElement('div');
        fit.className = 'card-fit';
        fit.textContent = 'reads ' + cols.join(', ');
        body.appendChild(fit);
      }
    }

    card.append(canvas, body);
    this._observer.observe(canvas);
    return card;
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

  _mount(host, id) {
    const def = CHARTS.find((c) => c.id === id);
    if (!def) return;
    // Yield a frame so a fast scroll does not build charts it will discard.
    requestAnimationFrame(() => {
      if (!host.isConnected) return;
      try {
        const inst = renderChart(def, host, newSpec(def), { height: PREVIEW_HEIGHT, compact: true });
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
