/**
 * StudioApp.js — wires the studio page together.
 *
 * Owns the live spec for the chart currently being edited, rebuilds the
 * preview and the code panel whenever it changes, and keeps the URL in step so
 * a chart in progress can be linked to.
 */

import { CHARTS, CATEGORIES, getChart, chartIndex, newSpec } from './registry.js';
import { renderChart, destroyInstance, resizeInstance, renderLegend, generateCode } from './engines.js';
import { buildControls } from './ControlPanel.js';
import { CodePanel } from './CodePanel.js';
import { renderSources } from './SourcesPanel.js';
import { renderHelp } from './HelpPanel.js';
import { buildPrompt } from './prompt.js';
import { openDataDialog } from './DataDialog.js';
import { mountThemeToggle, onThemeChange } from './theme.js';
import { toast } from './toast.js';
import { decodeSpec, buildShareUrl, URL_COMFORTABLE } from './share.js';
import { takeHandOff } from './DataMatch.js';
import { applyData } from './dataio.js';
import { initMotion, markChanged } from './motion.js';

const $ = (sel, root = document) => root.querySelector(sel);

/** Which rail categories the visitor has collapsed. */
const RAIL_KEY = 'opencharts.rail';

/**
 * Whether the rail is collapsed to its spine.
 *
 * A separate key from `RAIL_KEY` on purpose: that one holds a JSON map of
 * which categories are open, and writing 'mini' over it would throw away
 * every group the reader had arranged.
 */
const RAIL_MODE_KEY = 'opencharts.rail-mode';

/** CSS.escape is not in every browser this may be opened in. */
const cssEscape = (value) => {
  const s = String(value == null ? '' : value);
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
  // Chart ids are [a-z0-9-] by convention, so this fallback only has to be safe.
  return s.replace(/[^a-zA-Z0-9_-]/g, '');
};

export class StudioApp {
  constructor() {
    this.def = null;
    this.spec = null;
    this.inst = null;
    this.codePanel = new CodePanel($('#codepanel'));
    this.codePanel.onApplySpec = (parsed) => this._applySpec(parsed);
    this.sourcesEl = $('#sources');
    this.helpEl = $('#help');

    this._cacheDom();
    this._buildRail();
    this._bindChrome();
    initMotion();

    // Re-render on width change; charts that draw to raw canvas need it, and
    // Chart.js handles its own resize but a rebuild keeps everything in step.
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(this.host);

    onThemeChange(() => this.rebuild());
    window.addEventListener('popstate', () => this._boot());

    this._boot();
  }

  /**
   * Open whatever the URL asks for. A shared spec has to be decoded before the
   * first render, so this is separate from the constructor.
   */
  async _boot() {
    const id = this._idFromUrl();
    const token = new URLSearchParams(location.search).get('s');
    const shared = token ? await decodeSpec(token) : null;
    if (token && !shared) toast('That shared link could not be read — showing the default', 'bad');
    this.load(id, { push: false, shared });
  }

  _cacheDom() {
    this.host       = $('#chart-host');
    this.legendEl   = $('#legend');
    this.metricsEl  = $('#metrics');
    this.controlsEl = $('#controls');
    this.railList   = $('#rail-list');
    this.titleEl    = $('#chart-title');
    this.blurbEl    = $('#chart-blurb');
    this.crumbEl    = $('#chart-crumb');
    this.stageTitle = $('#stage-title');
    this.idxEl      = $('#chart-idx');
    this.searchEl   = $('#rail-search');
  }

  _idFromUrl() {
    const id = new URLSearchParams(location.search).get('chart');
    return getChart(id) ? id : CHARTS[0].id;
  }

  /* ── Rail ──────────────────────────────────────────────────────────────── */

  /**
   * The rail is a set of collapsible category groups.
   *
   * Which groups are open is remembered per browser, except while a filter is
   * active — then every group with a match opens, because a closed group would
   * hide the very thing the search just found.
   */
  _buildRail(filter = '') {
    const q = filter.trim().toLowerCase();
    const searching = q.length > 0;
    this.railList.innerHTML = '';

    CATEGORIES.forEach((group) => {
      const matches = group.charts.filter((c) => !q || c.searchText.includes(q));
      if (!matches.length) return;

      const holdsActive = matches.some((c) => c.id === (this.def && this.def.id));
      const open = searching || holdsActive || this._isGroupOpen(group.name);

      const wrap = document.createElement('div');
      wrap.className = 'rail-group';
      wrap.dataset.open = String(open);
      wrap.dataset.group = group.name;

      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'rail-group-head';
      head.setAttribute('aria-expanded', String(open));
      head.innerHTML =
        `<span class="caret" aria-hidden="true">`
        + `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 2l3.5 3-3.5 3"/></svg>`
        + `</span>`
        + `<span class="rail-group-ico" aria-hidden="true">${GLYPHS[group.name] || ''}</span>`
        + `<span>${escapeHtml(group.name)}</span>`
        + `<span class="n">${matches.length}</span>`;

      const body = document.createElement('div');
      body.className = 'rail-group-body';
      const inner = document.createElement('div');

      matches.forEach((c) => {
        const a = document.createElement('a');
        a.className = 'rail-link';
        a.href = `studio.html?chart=${encodeURIComponent(c.id)}`;
        a.dataset.id = c.id;
        a.innerHTML = `<span class="ico" aria-hidden="true">${glyph(c)}</span><span>${escapeHtml(c.title)}</span>`;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          this.load(c.id);
          this._closeRailDrawer();
        });
        inner.appendChild(a);
      });

      body.appendChild(inner);

      head.addEventListener('click', () => {
        // Collapsed, the head is a glyph and its body is not on screen, so
        // toggling it would look like nothing happened. It opens the rail and
        // its own group instead — one click back to a list you can read.
        if (document.body.dataset.rail === 'mini') {
          this._setRailMini(false);
          wrap.dataset.open = 'true';
          head.setAttribute('aria-expanded', 'true');
          this._setGroupOpen(group.name, true);
          this._markActive();
          return;
        }
        const next = wrap.dataset.open !== 'true';
        wrap.dataset.open = String(next);
        head.setAttribute('aria-expanded', String(next));
        this._setGroupOpen(group.name, next);
        this._markActive();
      });

      wrap.append(head, body);
      this.railList.appendChild(wrap);
    });

    if (!this.railList.children.length) {
      const empty = document.createElement('div');
      empty.className = 'rail-label';
      empty.textContent = 'No charts match';
      this.railList.appendChild(empty);
    }

    this._markActive();
  }

  /* Open/closed state, persisted. Storage can throw in private windows. */
  _openGroups() {
    try {
      const raw = localStorage.getItem(RAIL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  _isGroupOpen(name) {
    const state = this._openGroups();
    // No stored preference yet: start with everything open so the rail reads
    // as a full contents page rather than ten closed drawers.
    return state ? state[name] !== false : true;
  }

  _setGroupOpen(name, open) {
    try {
      const state = this._openGroups() || {};
      state[name] = open;
      localStorage.setItem(RAIL_KEY, JSON.stringify(state));
    } catch { /* not persisted — the session still works */ }
  }

  _markActive() {
    const activeId = this.def && this.def.id;
    this.railList.querySelectorAll('.rail-link').forEach((a) => {
      const on = a.dataset.id === activeId;
      a.classList.toggle('active', on);
      if (on && a.offsetParent !== null) a.scrollIntoView({ block: 'nearest' });
    });

    // Mark a collapsed group that contains the current chart, so it is still
    // findable when closed.
    this.railList.querySelectorAll('.rail-group').forEach((wrap) => {
      const holds = !!wrap.querySelector(`.rail-link[data-id="${cssEscape(activeId)}"]`);
      const closed = wrap.dataset.open !== 'true';
      const head = wrap.querySelector('.rail-group-head');
      let dot = head.querySelector('.here');
      if (holds && closed) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'here';
          dot.title = 'The chart you are editing is in here';
          head.appendChild(dot);
        }
      } else if (dot) {
        dot.remove();
      }
    });
  }

  /**
   * Collapse the rail to its spine, or open it again.
   *
   * The width change does not fire a window resize, so the hand-drawn
   * renderers have to be told — and told *after* the transition, or they
   * measure a host that is still moving.
   */
  _setRailMini(on) {
    document.body.dataset.rail = on ? 'mini' : '';
    const btn = $('#rail-collapse');
    if (btn) {
      btn.setAttribute('aria-expanded', String(!on));
      btn.setAttribute('aria-label', on ? 'Expand the chart list' : 'Collapse the chart list');
      btn.title = on ? 'Expand the chart list' : 'Collapse the chart list';
    }
    // A private window throws on write; the mode still works, it just will not
    // be remembered — the same bargain `theme.js` makes.
    try { localStorage.setItem(RAIL_MODE_KEY, on ? 'mini' : 'full'); } catch { /* not fatal */ }
    this._afterLayoutChange();
  }

  /** Everything but the plate. */
  _setFocus(on) {
    document.body.dataset.focus = on ? '1' : '';
    const btn = $('#btn-focus');
    if (btn) btn.setAttribute('aria-pressed', String(on));
    this._afterLayoutChange();
  }

  /** Re-measure once the chrome has finished moving. */
  _afterLayoutChange() {
    clearTimeout(this._layoutTimer);
    this._layoutTimer = setTimeout(() => this._onResize(), 240);
  }

  _closeRailDrawer() {
    $('#rail')?.classList.remove('open');
    $('#rail-scrim')?.classList.remove('open');
    document.body.classList.remove('rail-open');
  }

  /* ── Chrome ────────────────────────────────────────────────────────────── */

  _bindChrome() {
    mountThemeToggle($('#theme-mount'));

    this.searchEl?.addEventListener('input', () => this._buildRail(this.searchEl.value));

    $('#btn-prev')?.addEventListener('click', () => this._step(-1));
    $('#btn-next')?.addEventListener('click', () => this._step(1));
    $('#btn-reset')?.addEventListener('click', () => {
      this.spec = newSpec(this.def);
      buildControls(this.controlsEl, this.def, this.spec, () => this._onEdit());
      this.rebuild();
      toast('Reset to defaults', 'ok');
    });
    $('#btn-png')?.addEventListener('click', () => this._exportPNG());
    $('#btn-share')?.addEventListener('click', () => this._share());
    $('#btn-embed')?.addEventListener('click', () => this._embed());
    $('#btn-prompt')?.addEventListener('click', () => this._copyPrompt());

    // Restore the rail the way it was left. Read once, here, rather than at
    // module load: a private window can throw on read too.
    let savedRail = null;
    try { savedRail = localStorage.getItem(RAIL_MODE_KEY); } catch { /* not fatal */ }
    if (savedRail === 'mini') this._setRailMini(true);

    $('#rail-collapse')?.addEventListener('click', () => {
      this._setRailMini(document.body.dataset.rail !== 'mini');
    });
    $('#btn-focus')?.addEventListener('click', () => {
      this._setFocus(document.body.dataset.focus !== '1');
    });

    const railToggle = $('#rail-toggle');
    const rail = $('#rail');
    const scrim = $('#rail-scrim');
    railToggle?.addEventListener('click', () => {
      rail.classList.toggle('open');
      scrim.classList.toggle('open');
    });
    scrim?.addEventListener('click', () => this._closeRailDrawer());
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      this._closeRailDrawer();
      // Escape is the way out of a mode you may have entered by accident.
      if (document.body.dataset.focus === '1') this._setFocus(false);
    });

    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+F works while typing; it is a view command, not a text one.
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        this._setFocus(document.body.dataset.focus !== '1');
        return;
      }
      // `e.target` is not always an Element — a key event dispatched at the
      // document has the document as its target, and `document.matches` does
      // not exist. Reaching for it there throws and kills the handler, taking
      // the bracket shortcuts with it.
      const t = e.target;
      if (t && typeof t.matches === 'function' && t.matches('input, textarea, select')) return;
      if (e.key === '[') this._step(-1);
      if (e.key === ']') this._step(1);
      // A bare key, so it stays out of the way of the browser's own.
      if (e.key === '\\') this._setRailMini(document.body.dataset.rail !== 'mini');
    });
  }

  _step(delta) {
    const i = chartIndex(this.def.id);
    const next = CHARTS[(i + delta + CHARTS.length) % CHARTS.length];
    this.load(next.id);
  }

  /* ── Load & render ─────────────────────────────────────────────────────── */

  load(id, { push = true, shared = null } = {}) {
    const def = getChart(id);
    if (!def) return;

    destroyInstance(this.inst);
    this.inst = null;
    this.def = def;
    // A shared link carries a whole spec. Merge it over the defaults rather
    // than replacing them, so a link made before a chart gained a new option
    // still opens.
    this.spec = shared ? { ...newSpec(def), ...shared } : newSpec(def);
    this.isShared = !!shared;

    // A reader who matched a table in the gallery and clicked through meant to
    // draw *that*, not the example. It travels in session storage because a
    // table does not fit in a URL, and is taken exactly once — a later reload
    // of the same page is a fresh start, not a repeat of somebody's paste.
    if (!shared) {
      const brought = takeHandOff();
      if (brought) {
        const res = applyData(def, this.spec, brought);
        if (res.ok) {
          if (typeof def.onChange === 'function') def.onChange(this.spec);
          this.broughtData = res.message;
        }
      }
    }

    if (push) {
      history.pushState({ id }, '', `studio.html?chart=${encodeURIComponent(id)}`);
    }
    document.title = `${def.title} — OpenCharts Studio`;

    this.titleEl.innerHTML = `${escapeHtml(def.title)} <em>Studio</em>`;
    this.blurbEl.textContent = def.blurb;
    this.crumbEl.innerHTML =
      `<a href="index.html">Library</a><span class="sep">/</span>`
      + `<span>${escapeHtml(def.category)}</span><span class="sep">/</span>`
      + `<span>${escapeHtml(def.title)}</span>`;
    this.stageTitle.textContent = def.title;
    this.idxEl.textContent = `${chartIndex(id) + 1} / ${CHARTS.length}`;

    buildControls(this.controlsEl, def, this.spec, () => this._onEdit());
    this._markActive();
    this.rebuild();

    if (this.broughtData) {
      toast('Your table — ' + this.broughtData, 'ok');
      this.broughtData = null;
    }
  }

  _onEdit() {
    if (typeof this.def.onChange === 'function') this.def.onChange(this.spec);
    // The URL still carries the spec this session opened with; once it is
    // edited that token is stale, so drop it rather than let Back or a copied
    // address bar restore the wrong chart.
    if (this.isShared) {
      this.isShared = false;
      const url = new URL(location.href);
      url.searchParams.delete('s');
      history.replaceState({ id: this.def.id }, '', url.toString());
    }
    this.rebuild();
  }

  /** Open the full-size data editor. */
  editData() {
    openDataDialog(this.def, this.spec, () => {
      if (typeof this.def.onChange === 'function') this.def.onChange(this.spec);
      // Rebuild the controls too: new data can mean a different number of series.
      buildControls(this.controlsEl, this.def, this.spec, () => this._onEdit());
      this.rebuild();
    });
  }

  /** Copy a link that reproduces exactly what is on screen. */
  async _share() {
    try {
      const url = await buildShareUrl(this.def.id, this.spec);
      await navigator.clipboard.writeText(url);
      if (url.length > URL_COMFORTABLE) {
        toast('Link copied — it is long, so some chat apps may truncate it', 'ok', 4200);
      } else {
        toast('Shareable link copied', 'ok');
      }
    } catch {
      toast('Could not copy the link', 'bad');
    }
  }

  /**
   * Copy the AI brief for the chart as it stands.
   *
   * The prompt already exists as a tab, but that is three actions down the
   * page — switch tab, find Copy, click. This is the same action the gallery
   * tiles offer, in the one place a reader is already looking. It deliberately
   * does not switch the code panel: someone reading the JS did not ask to
   * lose their place.
   */
  async _copyPrompt() {
    const btn = $('#btn-prompt');
    const label = btn ? btn.innerHTML : '';
    try {
      const text = this.codePanel.promptText();
      if (!text) { toast('This chart has no prompt yet', 'bad'); return; }
      await navigator.clipboard.writeText(text);
      if (btn) {
        btn.innerHTML = '<span aria-hidden="true">✓</span> Copied';
        setTimeout(() => { btn.innerHTML = label; }, 1800);
      }
      toast(this.codePanel.promptMode === 'data'
        ? 'Data-only prompt copied — attach your spreadsheet to any AI'
        : 'Prompt copied — attach your spreadsheet to any AI', 'ok');
    } catch {
      toast('Could not copy the prompt', 'bad');
    }
  }

  /** The same link, as an <iframe> somebody can paste into a page. */
  async _embed() {
    try {
      const url = new URL(await buildShareUrl(this.def.id, this.spec));
      url.searchParams.set('embed', '1');
      const height = (this.def.canvas || this.def.d3 || this.def.dom || {}).height || 420;
      const tag = `<iframe src="${url.toString()}" width="100%" height="${height + 40}"`
        + ` style="border:1px solid #e5e5e5;border-radius:10px"`
        + ` title="${escapeHtml(this.def.title)}" loading="lazy"></iframe>`;
      await navigator.clipboard.writeText(tag);
      toast('Embed code copied', 'ok');
    } catch {
      toast('Could not copy the embed code', 'bad');
    }
  }

  rebuild() {
    if (!this.def) return;
    destroyInstance(this.inst);
    this.inst = renderChart(this.def, this.host, this.spec);

    const items = this.def.legend ? this.def.legend(this.spec) : null;
    renderLegend(this.legendEl, items, this.inst);
    this._renderMetrics();

    const code = generateCode(this.def, this.spec);
    // The chart as data. Self-describing, so a spec pasted into a different
    // chart's studio can open the chart it actually belongs to rather than
    // being merged into one that will ignore half of it.
    code.spec = JSON.stringify({ chart: this.def.id, spec: this.spec }, null, 2);
    // Built here rather than inside generateCode: the prompt quotes the
    // Standalone export, so it has to come after it, and it is a brief about
    // the chart rather than one of its four code views.
    // Both forms, because the panel switches between them without a rebuild.
    // The short one costs nothing next to the code generation above it.
    code.prompt = buildPrompt(this.def, this.spec, code, 'full');
    code.promptShort = buildPrompt(this.def, this.spec, code, 'data');
    this.codePanel.setCode(code, this.def.id);
    if (this.sourcesEl) renderSources(this.sourcesEl, code.deps || []);
    if (this.helpEl) renderHelp(this.helpEl, this.def, this.spec, () => this.editData());
  }

  /**
   * Take a pasted spec.
   *
   * Merged over the chart's defaults rather than replacing them — the same
   * rule a share link follows, so a spec written before the chart gained an
   * option still opens instead of rendering with holes in it.
   *
   * @returns {{ ok: boolean, message: string }}
   */
  _applySpec(parsed) {
    // The panel writes `{ chart, spec }`; a bare spec object from somewhere
    // else is accepted too rather than refused on a technicality.
    const inner = parsed.spec && typeof parsed.spec === 'object' && !Array.isArray(parsed.spec)
      ? parsed.spec
      : parsed;
    const wantId = typeof parsed.chart === 'string' ? parsed.chart : '';

    if (wantId && wantId !== this.def.id) {
      const def = getChart(wantId);
      if (!def) return { ok: false, message: `No chart called "${wantId}" — check the id.` };
      this.load(wantId, { shared: inner });
      return { ok: true, message: `Opened ${def.title} from the pasted spec` };
    }

    this.spec = { ...newSpec(this.def), ...inner };
    if (typeof this.def.onChange === 'function') this.def.onChange(this.spec);
    buildControls(this.controlsEl, this.def, this.spec, () => this._onEdit());
    this.rebuild();
    return { ok: true, message: 'Spec applied' };
  }

  _renderMetrics() {
    const metrics = this.def.metrics ? this.def.metrics(this.spec) : null;
    if (!metrics || !metrics.length) {
      this.metricsEl.style.display = 'none';
      this.metricsEl.innerHTML = '';
      return;
    }
    // What each figure read before this rebuild, so only the ones that moved
    // are marked. Flashing the whole row on every keystroke would make the
    // signal meaningless — the point is to say *which* number changed.
    const previous = [...this.metricsEl.querySelectorAll('.metric-value')].map((n) => n.textContent);

    this.metricsEl.style.display = 'grid';
    this.metricsEl.innerHTML = metrics.map((m) =>
      `<div class="metric"><div class="metric-label">${escapeHtml(m.label)}</div>`
      + `<div class="metric-value">${escapeHtml(m.value)}</div></div>`).join('');

    // Only when the row kept its shape; a different set of metrics is a new
    // chart, not a changed value.
    if (previous.length === metrics.length) {
      this.metricsEl.querySelectorAll('.metric-value').forEach((node, i) => {
        if (previous[i] !== undefined && previous[i] !== node.textContent) markChanged(node);
      });
    }
  }

  _onResize() {
    // Chart.js and the engine handle their own resize; the hand-drawn
    // renderers need to be told.
    if (this.inst && this.inst.redraw) resizeInstance(this.inst);
  }

  _exportPNG() {
    const canvas = this.host.querySelector('canvas');
    if (canvas) {
      // Repaint onto an opaque background so the PNG is not transparent.
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const ctx = out.getContext('2d');
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(canvas, 0, 0);
      downloadDataUrl(out.toDataURL('image/png'), `${this.def.id}.png`);
      toast('PNG exported', 'ok');
      return;
    }

    const svg = this.host.querySelector('svg');
    if (svg) {
      // SVG charts export as .svg — rasterising them here would need a
      // round-trip through an Image and would silently drop CSS-inherited ink.
      const clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      downloadDataUrl(url, `${this.def.id}.svg`);
      URL.revokeObjectURL(url);
      toast('SVG exported', 'ok');
      return;
    }

    toast('This chart has no canvas to export', 'bad');
  }
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function downloadDataUrl(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** A tiny inline SVG per category — cheaper and sharper than an icon font. */
const GLYPHS = {
  'Line & Area':   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 12l4-5 3 3 7-8"/></svg>',
  'Bar':           '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="8" width="3" height="7" rx="1"/><rect x="6.5" y="4" width="3" height="11" rx="1"/><rect x="12" y="1" width="3" height="14" rx="1"/></svg>',
  'Part to Whole': '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.4"/><path d="M8 1.6V8l4.6 4.4"/></svg>',
  'Radar':         '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1l6.1 4.4-2.3 7.2H4.2L1.9 5.4z"/><path d="M8 4.6l3.1 2.2-1.2 3.6H6.1L4.9 6.8z"/></svg>',
  'Scatter':       '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="11.5" r="1.8"/><circle cx="8" cy="6.5" r="1.8"/><circle cx="12.5" cy="9.5" r="1.8"/><circle cx="11" cy="3.5" r="1.4"/></svg>',
  'Distribution':  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 13c2.5 0 2.5-9 5-9s2.5 9 5 9 2.5-4.5 4-4.5"/></svg>',
  'Hierarchy':     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.2" y="1.2" width="13.6" height="13.6" rx="1.6"/><path d="M7 1.2v13.6M7 8h7.8"/></svg>',
  'Flow':          '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 4h5c3 0 3 8 6 8h3"/><path d="M1 11h4"/></svg>',
  'Comparison':    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12L14 4"/><circle cx="2" cy="12" r="1.6" fill="currentColor"/><circle cx="14" cy="4" r="1.6" fill="currentColor"/></svg>',
  'Custom Engine': '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1.4l5.7 3.3v6.6L8 14.6 2.3 11.3V4.7z"/><circle cx="8" cy="8" r="2.1"/></svg>',
  // The five that used to fall through to the bar glyph. Harmless in the
  // expanded rail, where the category is spelled out beside it — but the
  // collapsed spine is nothing *but* the glyph, so five categories sharing
  // one mark would make five of the fifteen unreachable by sight.
  'Deviation':     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 8h14"/><rect x="3" y="3" width="3" height="5" rx=".8" fill="currentColor" stroke="none"/><rect x="10" y="8" width="3" height="5" rx=".8" fill="currentColor" stroke="none"/></svg>',
  'Network':       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 4l8 3M4 4l2 8M12 7l-6 5"/><circle cx="4" cy="4" r="1.9" fill="currentColor" stroke="none"/><circle cx="12.2" cy="7" r="1.7" fill="currentColor" stroke="none"/><circle cx="6" cy="12.4" r="1.7" fill="currentColor" stroke="none"/></svg>',
  'Finance':       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 2.5v11M11.5 2.5v11"/><rect x="2" y="5" width="4" height="5" rx=".7" fill="currentColor" stroke="none"/><rect x="9.5" y="7" width="4" height="5" rx=".7" fill="currentColor" stroke="none"/></svg>',
  'Geo':           '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.4"/><path d="M1.7 8h12.6M8 1.6c1.9 2 2.9 4 2.9 6.4S9.9 12.4 8 14.4c-1.9-2-2.9-4-2.9-6.4S6.1 3.6 8 1.6z"/></svg>',
  'KPI & Micro':   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M1.5 11.5l3-3 2.5 2 3.5-5"/><path d="M11 5.5h3.5V9"/></svg>',
};

function glyph(def) {
  return GLYPHS[def.category] || GLYPHS['Bar'];
}

export { glyph, escapeHtml };
