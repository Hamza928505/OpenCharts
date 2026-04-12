/* ═══════════════════════════════════════════════════
   line-shared.js
   Shared utilities for 01 – 04 Line Chart Designer pages.
   Exposes everything on  window.LC  — no module syntax,
   so page inline <script> tags can access it directly.
   Requires: SweetAlert2 + Chart.js loaded before this file.
═══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var LC = {};

  // ── Colour palette ───────────────────────────────
  LC.PALETTE = [
    '#7F77DD', // violet  (accent)
    '#38D9A9', // teal    (accent2)
    '#F7A94D', // amber
    '#F76D6D', // coral
    '#A78BFA', // purple
    '#60A5FA', // sky
  ];

  // ── Common month labels ──────────────────────────
  LC.MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
               'Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── Chart.js shared tick style ───────────────────
  LC.TICK = {
    color: 'rgba(255,255,255,.45)',
    font: { family: "'DM Mono', monospace", size: 10.5, weight: '600' },
    padding: 10,
  };

  /**
   * Base Chart.js options.
   * @param {object} extras – merged at top level (e.g. { scales: … })
   */
  LC.baseOpts = function (extras) {
    var base = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'start',
          labels: {
            color: 'rgba(255,255,255,.65)',
            font: { family: "'DM Mono', monospace", size: 11, weight: '600' },
            boxWidth: 24, boxHeight: 2,
            padding: 18,
            usePointStyle: false,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(18,20,28,.96)',
          borderColor: 'rgba(255,255,255,.1)',
          borderWidth: 1,
          titleColor: 'rgba(255,255,255,.9)',
          bodyColor: 'rgba(255,255,255,.6)',
          titleFont: { family: "'DM Mono', monospace", size: 11, weight: '700' },
          bodyFont:  { family: "'DM Mono', monospace", size: 11 },
          padding: 12,
          cornerRadius: 10,
        },
      },
    };
    if (extras) {
      Object.keys(extras).forEach(function (k) { base[k] = extras[k]; });
    }
    return base;
  };

  /**
   * X-axis config.
   * @param {object} overrides
   */
  LC.xAxis = function (overrides) {
    var cfg = {
      grid:   { color: 'rgba(255,255,255,.06)', drawBorder: false },
      border: { display: false, dash: [4, 4] },
      ticks:  Object.assign({}, LC.TICK, { padding: 8 }),
    };
    if (overrides) Object.keys(overrides).forEach(function (k) { cfg[k] = overrides[k]; });
    return cfg;
  };

  /**
   * Y-axis config.
   * @param {object} overrides  e.g. { ticks: { …LC.TICK, callback: v => '$'+v }, min: 0, max: 120 }
   */
  LC.yAxis = function (overrides) {
    var cfg = {
      grid:   { color: 'rgba(255,255,255,.06)', drawBorder: false },
      border: { display: false },
      ticks:  Object.assign({}, LC.TICK),
    };
    if (overrides) Object.keys(overrides).forEach(function (k) { cfg[k] = overrides[k]; });
    return cfg;
  };

  // ── SweetAlert2 presets ──────────────────────────
  LC.SWAL_DARK = {
    background: 'var(--surface)',
    color:      'var(--text)',
    confirmButtonColor: '#7F77DD',
    cancelButtonColor:  'transparent',
    customClass: {
      popup:         'swal-lc-popup',
      confirmButton: 'swal-lc-confirm',
      cancelButton:  'swal-lc-cancel',
    },
  };

  // Toast mixin – initialised lazily so Swal is definitely ready
  var _toast = null;
  function getToast() {
    if (!_toast) {
      _toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true,
        background: 'var(--surface)',
        color: 'var(--text)',
        iconColor: '#38D9A9',
        customClass: { popup: 'swal-lc-toast' },
      });
    }
    return _toast;
  }

  /** Fire a bottom-right success toast */
  LC.toastSuccess = function (title) {
    getToast().fire({ icon: 'success', title: title });
  };

  /** Fire a bottom-right info toast */
  LC.toastInfo = function (title) {
    getToast().fire({ icon: 'info', title: title });
  };

  /**
   * SweetAlert2 confirm before removing a series.
   * Returns the SweetAlertResult promise.
   */
  LC.confirmRemoveSeries = function (seriesLabel) {
    return Swal.fire(Object.assign({
      title: 'Remove series?',
      html:  '<span style="font-size:.88rem;color:var(--muted)">Remove <strong style="color:var(--text)">'
             + seriesLabel + '</strong> from the chart?</span>',
      icon: 'warning',
      showCancelButton:    true,
      confirmButtonText:   '<i class="bi bi-trash3"></i>&nbsp;Remove',
      cancelButtonText:    'Keep it',
      reverseButtons:      true,
      focusCancel:         true,
    }, LC.SWAL_DARK));
  };

  // ── UI helpers ───────────────────────────────────

  /**
   * Sync a colour swatch element + hex text element to a colour.
   * @param {string} swatchId
   * @param {string} hexId
   * @param {string} color   hex string e.g. '#7F77DD'
   */
  LC.syncColorUI = function (swatchId, hexId, color) {
    var swatch = document.getElementById(swatchId);
    var hex    = document.getElementById(hexId);
    if (swatch) swatch.style.background = color;
    if (hex)    hex.textContent          = color.toUpperCase();
  };

  /**
   * Re-render gutter line numbers to match line count of code string.
   * @param {string} gutterId
   * @param {string} text
   */
  LC.updateGutter = function (gutterId, text) {
    var gutter = document.getElementById(gutterId);
    if (!gutter) return;
    var count = text.split('\n').length;
    var nums  = [];
    for (var i = 1; i <= count; i++) nums.push(i);
    gutter.innerHTML = nums.join('<br>');
  };

  /**
   * Write code into #code-display textarea and sync gutter.
   * @param {string} text
   */
  LC.displayCode = function (text) {
    var area = document.getElementById('code-display');
    if (area) area.value = text;
    LC.updateGutter('lc-gutter', text);
  };

  /**
   * Wire all .lc-tab buttons, calling onTabChange(tabKey) on click.
   * @param {function} onTabChange
   */
  LC.initTabs = function (onTabChange) {
    document.querySelectorAll('.lc-tab').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        document.querySelectorAll('.lc-tab').forEach(function (b) { b.classList.remove('active'); });
        e.currentTarget.classList.add('active');
        onTabChange(e.currentTarget.getAttribute('data-tab'));
      });
    });
  };

  /**
   * Wire a .lc-toggle-row button with label swapping.
   * @param {string}   btnId
   * @param {string}   labelOn      text when active   e.g. 'Hide Points'
   * @param {string}   labelOff     text when inactive e.g. 'Show Points'
   * @param {boolean}  startActive
   * @param {function} onChange     called with (active: boolean)
   */
  LC.initToggle = function (btnId, labelOn, labelOff, startActive, onChange) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    var lbl = btn.querySelector('.lc-toggle-text');

    // Apply initial state
    if (startActive) {
      btn.classList.add('active');
      if (lbl) lbl.textContent = labelOn;
    } else {
      btn.classList.remove('active');
      if (lbl) lbl.textContent = labelOff;
    }

    btn.addEventListener('click', function () {
      var active = btn.classList.toggle('active');
      if (lbl) lbl.textContent = active ? labelOn : labelOff;
      onChange(active);
    });
  };

  /**
   * Attach window.copyActiveCode used by the copy button onclick.
   * Uses Clipboard API with execCommand fallback; shows SweetAlert2 toast.
   */
  LC.initCopyBtn = function () {
    global.copyActiveCode = function () {
      var area = document.getElementById('code-display');
      if (!area) return;

      var text = area.value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          LC.toastSuccess('Code copied to clipboard!');
        }).catch(function () {
          fallbackCopy(area);
        });
      } else {
        fallbackCopy(area);
      }
    };

    function fallbackCopy(area) {
      area.select();
      try {
        document.execCommand('copy');
        LC.toastSuccess('Code copied to clipboard!');
      } catch (e) {
        LC.toastInfo('Press Ctrl+C / ⌘+C to copy.');
      }
    }
  };

  /**
   * Build and append a series card into the series list, wiring all events.
   *
   * @param {object}   series        – { id, label, color, data }
   * @param {Array}    seriesStore   – the master array
   * @param {function} onChanged     – called after any mutation (re-renders chart + code)
   * @param {number}   [minSeries=1] – disable remove when count <= minSeries
   * @returns {HTMLElement} the card element
   */
  LC.buildSeriesCard = function (series, seriesStore, onChanged, minSeries) {
    minSeries = minSeries || 1;

    var card = document.createElement('div');
    card.className  = 'lc-sc';
    card.dataset.id = series.id;

    card.innerHTML =
      '<div class="lc-sc-top">' +
        '<span class="lc-sc-bar" style="background:' + series.color + '"></span>' +
        '<input class="lc-sc-label" type="text" value="' + series.label + '" placeholder="Series name…">' +
        '<button class="lc-sc-remove" title="Remove series"><i class="bi bi-x-lg"></i></button>' +
      '</div>' +
      '<div class="lc-sc-colors">' +
        '<label class="lc-sc-color-field" title="Line colour">' +
          '<span class="lc-sc-swatch" style="background:' + series.color + '"></span>' +
          '<span class="lc-sc-color-info">' +
            '<span class="lc-sc-cname">Line</span>' +
            '<span class="lc-sc-chex">' + series.color.toUpperCase() + '</span>' +
          '</span>' +
          '<input type="color" class="lc-sc-color-input" value="' + series.color + '">' +
        '</label>' +
      '</div>';

    // Label
    card.querySelector('.lc-sc-label').addEventListener('input', function (e) {
      series.label = e.target.value.trim() || 'Series';
      onChanged();
    });

    // Colour
    card.querySelector('.lc-sc-color-input').addEventListener('input', function (e) {
      var c = e.target.value;
      series.color = c;
      card.querySelector('.lc-sc-bar').style.background    = c;
      card.querySelector('.lc-sc-swatch').style.background = c;
      card.querySelector('.lc-sc-chex').textContent        = c.toUpperCase();
      onChanged();
    });

    // Remove
    card.querySelector('.lc-sc-remove').addEventListener('click', function () {
      if (seriesStore.length <= minSeries) return;

      LC.confirmRemoveSeries(series.label).then(function (result) {
        if (!result.isConfirmed) return;
        var idx = seriesStore.findIndex(function (s) { return s.id === series.id; });
        if (idx !== -1) seriesStore.splice(idx, 1);
        card.remove();
        onChanged();
      });
    });

    return card;
  };

  /**
   * Refresh the disabled state of all remove buttons and the series-count badge.
   * @param {Array}  seriesStore
   * @param {number} [minSeries=1]
   */
  LC.refreshRemoveButtons = function (seriesStore, minSeries) {
    minSeries = minSeries || 1;
    var disabled = seriesStore.length <= minSeries;
    document.querySelectorAll('.lc-sc-remove').forEach(function (btn) {
      btn.disabled = disabled;
    });
    var badge = document.getElementById('series-count');
    if (badge) badge.textContent = seriesStore.length;
  };

  // ── Export ───────────────────────────────────────
  global.LC = LC;

}(window));