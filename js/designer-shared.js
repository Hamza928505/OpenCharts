/**
 * designer-shared.js
 * Shared UI logic for every chart designer page.
 *
 * Eliminates copy-paste across pages. Provides:
 *   toggle()           — toggle-switch button wiring
 *   displayCode()      — write code to the terminal viewer + gutter
 *   initColorPickers() — build colour-picker rows, returns rebuild()
 *   initTabGroup()     — wire JS / HTML / JSON tabs, returns getActiveTab()
 *   initCopyButton()   — clipboard copy + SweetAlert2 fallback
 *   initExportPNG()    — PNG download + success toast
 *   initSaveConfig()   — JSON blob save
 *   initLoadConfig()   — JSON file load (line designer "load config" button)
 *
 * SweetAlert2 is expected as window.Swal (loaded via <script> tag before
 * the module), so we reference it through window to avoid import errors.
 */

/* ─────────────────────────────────────────────────
 * Internal helpers
 * ──────────────────────────────────────────────── */

function swal(opts) {
  window.Swal?.fire({ background: '#1a1a28', color: '#e8e8f0', ...opts });
}

/** getElementById with optional warning suppression. */
function el(id, silent = false) {
  const node = document.getElementById(id);
  if (!node && !silent) console.warn(`[designer-shared] element #${id} not found`);
  return node;
}

/** Try multiple ids in order, return first found (silently). */
function elFirst(...ids) {
  for (const id of ids) {
    const node = document.getElementById(id);
    if (node) return node;
  }
  return null;
}

/* ─────────────────────────────────────────────────
 * Public API
 * ──────────────────────────────────────────────── */

export const designerInit = {

  /* ── Toggle switch ─────────────────────────────── */
  toggle(btnId, trackId, initial, onChange) {
    let state = initial;
    const btn   = el(btnId);
    const track = el(trackId);
    if (!btn || !track) return;
    track.classList.toggle('on', state);
    btn.addEventListener('click', () => {
      state = !state;
      track.classList.toggle('on', state);
      onChange(state);
    });
  },

  /* ── Code viewer ───────────────────────────────── */
  displayCode(code) {
    const area   = el('code-display');
    const gutter = el('gutter');
    if (!area || !gutter) return;

    area.value = code;

    // Rebuild line-number spans (one <span> per line — matches CSS line-height grid)
    const lineCount = code.split('\n').length;
    gutter.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= lineCount; i++) {
      const span = document.createElement('span');
      span.textContent = i;
      frag.appendChild(span);
    }
    gutter.appendChild(frag);

    // Sync gutter scroll offset with textarea (attach listener once per element)
    if (!area._gutterSyncBound) {
      area.addEventListener('scroll', () => {
        gutter.style.transform = `translateY(-${area.scrollTop}px)`;
      });
      area._gutterSyncBound = true;
    }

    // Reset scroll on new code
    area.scrollTop = 0;
    gutter.style.transform = 'translateY(0)';
  },

  /* ── Colour pickers ────────────────────────────── */
  initColorPickers(containerId, items, onColorChange) {
    const container = el(containerId);
    if (!container) return { rebuild: () => {} };

    function buildRow(item, i) {
      const swId = `ds-sw-${i}`;
      const cpId = `ds-cp-${i}`;
      const hxId = `ds-hx-${i}`;
      const row  = document.createElement('div');
      row.className = 'color-row';
      row.dataset.colorIndex = i;
      row.innerHTML =
        `<span id="${swId}" class="color-swatch" style="background:${item.color}" title="Pick colour"></span>` +
        `<div class="color-meta">` +
          `<span class="color-name">${item.label}</span>` +
          `<span class="color-hex" id="${hxId}">${item.color}</span>` +
        `</div>` +
        `<i class="bi bi-eyedropper" style="color:var(--muted);font-size:.78rem;cursor:pointer;flex-shrink:0"></i>` +
        `<input type="color" id="${cpId}" value="${item.color}" ` +
               `style="opacity:0;width:0;height:0;position:absolute;pointer-events:none">`;

      const swatch  = row.querySelector(`#${swId}`);
      const picker  = row.querySelector(`#${cpId}`);
      const dropper = row.querySelector('.bi-eyedropper');
      const hexSpan = row.querySelector(`#${hxId}`);

      const open = () => picker.click();
      swatch.addEventListener('click', open);
      dropper.addEventListener('click', open);

      picker.addEventListener('input', (e) => {
        const hex = e.target.value;
        item.color              = hex;
        swatch.style.background = hex;
        hexSpan.textContent     = hex;
        onColorChange(i, hex);
      });

      return row;
    }

    function build() {
      container.innerHTML = '';
      items.forEach((item, i) => container.appendChild(buildRow(item, i)));
    }

    build();

    return {
      rebuild(newItems) {
        items.length = 0;
        newItems.forEach((it) => items.push(it));
        build();
      },
    };
  },

  /* ── Tab group ─────────────────────────────────── */
  initTabGroup(onTabChange) {
    let activeTab = 'js';
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab ?? 'js';
        onTabChange(activeTab);
      });
    });
    return { getActiveTab: () => activeTab };
  },

  /* ── Copy button ───────────────────────────────── */
  initCopyButton({ getCode, chartType, getActiveTab, tracker }) {
    const btn     = el('copy-btn');
    const iconEl  = el('copy-icon');
    const labelEl = el('copy-label');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(getCode());
        if (iconEl)  iconEl.className    = 'bi bi-check2';
        if (labelEl) labelEl.textContent = 'Copied!';
        setTimeout(() => {
          if (iconEl)  iconEl.className    = 'bi bi-clipboard';
          if (labelEl) labelEl.textContent = 'Copy';
        }, 2000);
        tracker?.trackExport(chartType, getActiveTab());
      } catch {
        swal({ icon: 'error', title: 'Copy failed',
               text: 'Please manually select and copy the code.' });
      }
    });
  },

  /* ── Export PNG ────────────────────────────────── */
  initExportPNG({ getChart, filename, chartType, tracker }) {
    const btn = el('btn-export-png');
    if (!btn) return;
    btn.addEventListener('click', () => {
      getChart()?.exportPNG(filename);
      swal({ icon: 'success', title: 'Chart exported!',
             text: `${filename} has been downloaded.`,
             timer: 2000, showConfirmButton: false });
      tracker?.trackExport(chartType, 'png');
    });
  },

  /* ── Save config ───────────────────────────────── */
  initSaveConfig({ getGenerator, filename }) {
    // Accept btn-save (bar/pie/area) or btn-save-config (line) — scatter has neither
    const btn = elFirst('btn-save', 'btn-save-config');
    if (!btn) return;
    btn.addEventListener('click', () => {
      try {
        const blob = new Blob([getGenerator().toSaveState()], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href: url, download: filename }).click();
        URL.revokeObjectURL(url);
        swal({ icon: 'success', title: 'Config saved!',
               text: `${filename} downloaded. Use "Load Config" to restore it.`,
               timer: 2500, showConfirmButton: false });
      } catch (err) {
        swal({ icon: 'error', title: 'Save failed', text: err.message });
      }
    });
  },

  /* ── Load config (line designer only) ─────────── */
  initLoadConfig({ onLoaded }) {
    const btn = el('btn-load-config');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const input  = document.createElement('input');
      input.type   = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader  = new FileReader();
        reader.onload = (ev) => {
          try {
            onLoaded(JSON.parse(ev.target.result));
            swal({ icon: 'success', title: 'Config loaded!',
                   timer: 2000, showConfirmButton: false });
          } catch (err) {
            swal({ icon: 'error', title: 'Invalid config file', text: err.message });
          }
        };
        reader.onerror = () => swal({ icon: 'error', title: 'File read error' });
        reader.readAsText(file);
      };
      input.click();
    });
  },

  /* ── Theme toggle ──────────────────────────────
   * Renders a sun/moon button into `containerId`,
   * persists choice to localStorage, and applies
   * data-theme="light"|"dark" to <html>.
   *
   * @param {string} containerId  Element to append the button into
   */
  initThemeToggle(containerId) {
    const container = el(containerId, true);   // silent — not every page has one
    if (!container) return;

    const STORAGE_KEY = 'ca_theme';
    const html = document.documentElement;

    // Read persisted preference, fall back to OS preference
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isDark = stored ? stored === 'dark' : prefersDark;

    // Apply immediately (before first paint)
    html.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Build button
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle light / dark mode');
    btn.setAttribute('title', 'Toggle theme');

    function sync() {
      btn.innerHTML = isDark
        ? '<i class="bi bi-sun-fill"></i> Light'
        : '<i class="bi bi-moon-fill"></i> Dark';
    }

    btn.addEventListener('click', () => {
      isDark = !isDark;
      html.setAttribute('data-theme', isDark ? 'dark' : 'light');
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
      sync();
    });

    sync();
    container.appendChild(btn);
  },
};