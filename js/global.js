/* ════════════ THEME ════════════ */
const html      = document.documentElement;

function applyTheme(t) {
  html.setAttribute('data-theme', t);
  localStorage.setItem('ca_theme', t);

  // desktop sidebar icon
  const di = document.getElementById('themeIcon');
  if (di) di.className = t === 'dark' ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
  // tablet sidebar icon
  const ti = document.getElementById('themeIconTablet');
  if (ti) ti.className = t === 'dark' ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
  // mobile bottom bar icon + label
  const mi = document.getElementById('themeIconMobile');
  const ml = document.getElementById('themeTextMobile');
  if (mi) mi.className = t === 'dark' ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
  if (ml) ml.textContent = t === 'dark' ? 'Dark' : 'Light';
}

function toggleTheme() {
  applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
function toggleThemeMobile(btn) {
  toggleTheme();
  // don't set active — theme tab is a toggle, not a page
}

document.getElementById('themeBtn').addEventListener('click', toggleTheme);
const tbt = document.getElementById('themeBtnTablet');
if (tbt) tbt.addEventListener('click', toggleTheme);

applyTheme(localStorage.getItem('ca_theme') || 'dark');

/* ════════════ VISITOR TRACKING ════════════
   sessionStorage  →  survives navigation within the tab,
                       cleared when tab is closed.
   localStorage    →  persists cumulative daily counts.

   Result: refreshing does NOT increment the counter.
   A genuine new session (new tab / new browser open) does.
═══════════════════════════════════════════ */
const STORE = 'ca_v3';

function getStats() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
function saveStats(s) { localStorage.setItem(STORE, JSON.stringify(s)); }
function todayKey()   { return new Date().toISOString().slice(0,10); }

function recordVisit() {
  if (sessionStorage.getItem('ca_sess')) return getStats(); // already counted this session
  sessionStorage.setItem('ca_sess', '1');
  const s = getStats(), k = todayKey();
  s[k]          = (s[k]          || 0) + 1;
  s.__total     = (s.__total     || 0) + 1;
  s.__lastVisit = new Date().toISOString();
  saveStats(s);
  return s;
}

function getLast7() {
  const s = getStats();
  return Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    const k = d.toISOString().slice(0,10);
    return { date: k, count: s[k] || 0 };
  });
}

function fmt(n) {
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'k';
  return String(n);
}

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s/60)+'m ago';
  if (s < 86400) return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}

/* ════════════ RENDER ════════════ */
function renderStats() {
  const s    = getStats();
  const days = getLast7();
  const today = days[6].count;
  const max   = Math.max(...days.map(d=>d.count), 1);

  document.getElementById('kpiTotal').textContent  = fmt(s.__total || 0);
  document.getElementById('kpiToday').textContent  = fmt(today);
  document.getElementById('navVisitors').textContent = fmt(s.__total || 0);
  document.getElementById('todayLabel').textContent  = todayKey();
  document.getElementById('kpiLastSeen').textContent = timeAgo(s.__lastVisit);

  setTimeout(() => {
    document.getElementById('todayBar').style.width = Math.round((today/max)*100)+'%';
  }, 400);

  // sparkline
  const el = document.getElementById('visitSpark');
  el.innerHTML = days.map((d,i) => {
    const h = Math.max(3, Math.round((d.count/max)*24));
    return `<div class="spark-bar ${i===6?'today':''}" style="height:${h}px;" title="${d.date}: ${d.count}"></div>`;
  }).join('');
}

/* ════════════ DIALOGS ════════════ */
function swBg() { return html.getAttribute('data-theme')==='dark'?'#161921':'#ffffff'; }
function swFg() { return html.getAttribute('data-theme')==='dark'?'#e8eaf2':'#111110'; }
function swS2() { return html.getAttribute('data-theme')==='dark'?'#1e2230':'#f0efeb'; }

function showVisitorDetail(e) {
  if (e) e.preventDefault();
  const s    = getStats();
  const days = getLast7();
  const rows = days.map(d =>
    `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:.76rem;padding:5px 0;color:${swFg()};">${d.date}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-size:.76rem;padding:5px 0;color:${swFg()};">${d.count}</td>
    </tr>`).join('');

  Swal.fire({
    title: 'Visitor Analytics',
    background: swBg(), color: swFg(),
    html: `
      <div style="text-align:left;font-family:'Syne',sans-serif;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
          <div style="background:${swS2()};border-radius:10px;padding:13px;">
            <div style="font-size:.58rem;color:#6b6a66;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px;">Total Sessions</div>
            <div style="font-size:1.6rem;font-weight:800;font-family:'DM Mono',monospace;">${fmt(s.__total||0)}</div>
          </div>
          <div style="background:${swS2()};border-radius:10px;padding:13px;">
            <div style="font-size:.58rem;color:#6b6a66;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px;">Today</div>
            <div style="font-size:1.6rem;font-weight:800;font-family:'DM Mono',monospace;">${fmt(days[6].count)}</div>
          </div>
        </div>
        <div style="font-size:.62rem;color:#6b6a66;margin-bottom:7px;font-family:'DM Mono',monospace;letter-spacing:.08em;">LAST 7 DAYS</div>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid rgba(128,128,128,.18);">${rows}</table>
        <div style="margin-top:11px;font-size:.66rem;color:#6b6a66;font-family:'DM Mono',monospace;">
          Last session: ${timeAgo(s.__lastVisit)} · stored in localStorage
        </div>
      </div>`,
    confirmButtonText: 'Close',
    confirmButtonColor: '#7F77DD',
  });
}

function showBackendInfo(e) {
  if (e) e.preventDefault();
  Swal.fire({
    title: 'Backend Visitor Tracking',
    background: swBg(), color: swFg(),
    html: `
      <div style="text-align:left;font-family:'Syne',sans-serif;font-size:.82rem;line-height:1.65;">
        <p style="margin-bottom:12px;">The current approach tracks sessions <strong>per browser only</strong>.
          It won't count the same user on a different device, in incognito, or after clearing storage.</p>
        <p style="font-size:.7rem;color:#6b6a66;margin-bottom:8px;">For real unique visitors you need a lightweight endpoint:</p>
        <ul style="font-family:'DM Mono',monospace;font-size:.7rem;color:#6b6a66;padding-left:16px;line-height:2;">
          <li>POST <code>/api/visit</code> on page load (server sets cookie)</li>
          <li>Hash the IP + User-Agent, store in a DB</li>
          <li>GET <code>/api/stats</code> to pull counts into the dashboard</li>
        </ul>
        <p style="margin-top:10px;font-size:.7rem;color:#6b6a66;">
          Free serverless options: <strong>Supabase</strong>, <strong>PocketBase</strong>,
          <strong>Cloudflare Workers + KV</strong>, <strong>Vercel Edge Functions</strong>.
        </p>
      </div>`,
    confirmButtonText: 'Got it',
    confirmButtonColor: '#7F77DD',
  });
}

function showExportDialog() {
  const lines = [...document.querySelectorAll('.chart-card')].map(c =>
    c.querySelector('.chart-card-title').textContent + ' — ' + c.getAttribute('href')
  ).join('\n');

  Swal.fire({
    title: 'Export chart list',
    background: swBg(), color: swFg(),
    html: `<textarea style="width:100%;height:176px;background:${swS2()};border:1px solid rgba(128,128,128,.22);
      border-radius:8px;color:${swFg()};font-family:'DM Mono',monospace;
      font-size:.67rem;padding:10px;resize:none;" readonly>${lines}</textarea>`,
    confirmButtonText: 'Copy to clipboard',
    confirmButtonColor: '#7F77DD',
    showCancelButton: true,
    cancelButtonText: 'Close',
    cancelButtonColor: swS2(),
    preConfirm: () => navigator.clipboard.writeText(lines),
  }).then(r => {
    if (r.isConfirmed)
      Swal.fire({ toast:true, position:'top-end', icon:'success', title:'Copied!',
        showConfirmButton:false, timer:1500, background:swBg(), color:swFg(), iconColor:'#38D9A9' });
  });
}

/* ════════════ SEARCH ════════════ */
function filterCharts(q) {
  const term = q.toLowerCase().trim();
  let visible = 0;

  document.querySelectorAll('.chart-card').forEach(c => {
    const match = !term ||
      c.querySelector('.chart-card-title').textContent.toLowerCase().includes(term) ||
      (c.dataset.tags||'').includes(term);
    c.style.display = match ? '' : 'none';
    if (match) visible++;
  });

  document.querySelectorAll('.csl').forEach(label => {
    const grid = label.nextElementSibling;
    if (!grid) return;
    const shown = grid.querySelectorAll('.chart-card:not([style*="none"])').length;
    label.style.display = shown ? '' : 'none';
    grid.style.display  = shown ? '' : 'none';
  });

  document.getElementById('noResults').style.display = visible === 0 ? 'block' : 'none';
}

/* ════════════ SIDEBAR (desktop/tablet) ════════════ */
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

document.querySelectorAll('#sidebar .nav-link').forEach(link => {
  link.addEventListener('click', function() {
    document.querySelectorAll('#sidebar .nav-link').forEach(l => l.classList.remove('active'));
    this.classList.add('active');
  });
});

/* ════════════ BOTTOM TAB BAR (mobile) ════════════ */
function setActiveTab(btn) {
  document.querySelectorAll('.bn-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

function scrollToTop(btn) {
  setActiveTab(btn);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function focusSearch(btn) {
  setActiveTab(btn);
  const el = document.getElementById('chartSearch');
  // scroll charts wrapper into view then focus
  document.querySelector('.charts-wrapper').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => { el.focus(); }, 400);
}

/* ════════════ BOTTOM DRAWER ════════════ */
function openDrawer(btn) {
  if (btn) setActiveTab(btn);
  document.getElementById('bottom-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  document.getElementById('bottom-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('show');
  document.body.style.overflow = '';
  // deactivate "Sections" tab
  document.querySelectorAll('.bn-tab').forEach(t => {
    if (t.classList.contains('bn-more')) t.classList.remove('active');
  });
}

// swipe-down to close drawer
(function() {
  const drawer = document.getElementById('bottom-drawer');
  let startY = 0, isDragging = false;
  drawer.addEventListener('touchstart', e => { startY = e.touches[0].clientY; isDragging = true; }, { passive: true });
  drawer.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) drawer.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  drawer.addEventListener('touchend', e => {
    isDragging = false;
    const dy = e.changedTouches[0].clientY - startY;
    drawer.style.transform = '';
    if (dy > 80) closeDrawer();
  });
})();

/* ════════════ INIT ════════════ */
(function init() {
  const s        = recordVisit();
  const isNewSess = !sessionStorage.getItem('ca_welcomed');
  renderStats();

  if (isNewSess) {
    sessionStorage.setItem('ca_welcomed', '1');
    const t = document.createElement('div');
    t.className = 'toast-pop';
    t.innerHTML = `
      <span style="font-size:.95rem;">${(s.__total||1) <= 1 ? '🎉' : '👋'}</span>
      <div>
        <div style="font-weight:700;font-size:.78rem;">
          ${(s.__total||1) <= 1 ? 'First visit recorded!' : 'Session recorded'}
        </div>
        <div style="color:var(--muted);font-size:.66rem;font-family:var(--mono);">
          Total: ${fmt(s.__total||1)} session${(s.__total||1)!==1?'s':''}
        </div>
      </div>
      <button onclick="this.parentElement.remove()">✕</button>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5000);
  }

  // Keep last-seen label fresh
  setInterval(() => {
    document.getElementById('kpiLastSeen').textContent = timeAgo(getStats().__lastVisit);
  }, 60000);
})();