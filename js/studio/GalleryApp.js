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

    this._buildFilters();
    this._buildStats();
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

    const matches = searchCharts(this.query, this.category);
    this.countEl.textContent = `${matches.length} of ${CHART_COUNT}`;

    if (!matches.length) {
      this.grid.innerHTML =
        '<div class="empty"><div class="display">Nothing here</div>'
        + '<p>No chart matches that search. Try a shape — "stacked", "radial", "flow".</p></div>';
      return;
    }

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

  _card(def) {
    const card = document.createElement('a');
    card.className = 'card';
    card.href = `studio.html?chart=${encodeURIComponent(def.id)}`;

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
