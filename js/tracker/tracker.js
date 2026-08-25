/**
 * tracker.js
 * Visitor and chart-export tracking via Supabase for static (GitHub Pages) hosting.
 *
 * WHY NOT A JSON FILE?
 *   JSON files on GitHub Pages are static — you can read them but not write to them
 *   without a server. Even if you used a GitHub Action to commit a new JSON on each
 *   visit, concurrent writes would cause race conditions and the latency would be
 *   multi-second. Supabase (or Firebase) gives us a real-time database with
 *   authenticated writes from the browser.
 *
 * WHY SUPABASE?
 *   - Generous free tier (500MB DB, unlimited auth, 2GB bandwidth)
 *   - Simple REST API — no SDK required for basic inserts/counts
 *   - Row-level security (RLS) lets us allow INSERT but block SELECT of raw IPs
 *   - Works from any static host with a single fetch() call
 *   - Easier GDPR story than Firebase (EU data residency available)
 *
 * ABUSE PROTECTION:
 *   - One session counted per browser tab (sessionStorage flag)
 *   - Supabase RLS policy: INSERT-only from anon key, no sensitive columns writable
 *   - Rate limiting via Supabase's built-in request quotas
 *   - No PII stored — only a hashed session ID, page path, and timestamp
 *
 * SETUP (one-time):
 *   1. Create a Supabase project at https://supabase.com
 *   2. Run the SQL in the comment below to create the required tables
 *   3. Set SUPABASE_URL and SUPABASE_ANON_KEY in this file (or inject via build step)
 *
 * SQL to run in Supabase SQL Editor:
 * ─────────────────────────────────
 *   CREATE TABLE visits (
 *     id         BIGSERIAL PRIMARY KEY,
 *     session_id TEXT    NOT NULL,
 *     page       TEXT    NOT NULL DEFAULT '/',
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 *   CREATE TABLE exports (
 *     id         BIGSERIAL PRIMARY KEY,
 *     chart_type TEXT    NOT NULL,
 *     format     TEXT    NOT NULL DEFAULT 'snippet',
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 *   -- Allow anonymous inserts, block everything else
 *   ALTER TABLE visits  ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
 *
 *   CREATE POLICY "anon_insert_visits"
 *     ON visits FOR INSERT TO anon WITH CHECK (true);
 *
 *   CREATE POLICY "anon_insert_exports"
 *     ON exports FOR INSERT TO anon WITH CHECK (true);
 *
 *   -- Public read-only view of aggregated counts (no raw data exposed)
 *   CREATE VIEW visit_stats AS
 *     SELECT COUNT(DISTINCT session_id) AS unique_visitors,
 *            COUNT(*) AS total_visits,
 *            MAX(created_at) AS last_visit
 *     FROM visits;
 *
 *   CREATE POLICY "anon_read_visit_stats"
 *     ON visit_stats FOR SELECT TO anon USING (true);
 * ─────────────────────────────────────────────────
 */

/* ─── Configuration ────────────────────────────── */

const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';   // ← replace
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';                  // ← replace

const SESSION_KEY  = 'ca_session_tracked';  // sessionStorage flag
const ENABLED      = SUPABASE_URL !== 'https://YOUR_PROJECT_ID.supabase.co';

/* ─── Tracker class ───────────────────────────── */

export class Tracker {

  constructor() {
    this._sessionId = getOrCreateSessionId();
    this._debug     = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  /* ── Visit tracking ──────────────────────────── */

  /**
   * Track a page visit. Safe to call on every page load —
   * internally guards against double-counting within the same browser tab.
   *
   * @param {string} [page]  Path to record (default: current pathname)
   */
  async trackVisit(page = location.pathname) {
    if (!ENABLED)                                     return this._devLog('Tracker disabled (URL not configured)');
    if (sessionStorage.getItem(SESSION_KEY) === '1')  return this._devLog('Visit already counted this session');

    try {
      await this._insert('visits', {
        session_id: this._sessionId,
        page:       page.slice(0, 200),
      });
      sessionStorage.setItem(SESSION_KEY, '1');
      this._devLog(`Visit tracked: ${page}`);
    } catch (err) {
      // Tracking errors must never break the app
      console.warn('[Tracker] trackVisit failed silently:', err.message);
    }
  }

  /* ── Export tracking ─────────────────────────── */

  /**
   * Track a chart code-copy / export event.
   *
   * @param {string} chartType  e.g. 'line', 'bar'
   * @param {string} [format]   e.g. 'snippet', 'html', 'js'
   */
  async trackExport(chartType, format = 'snippet') {
    if (!ENABLED) return this._devLog(`Export tracked locally: ${chartType}/${format}`);

    try {
      await this._insert('exports', {
        chart_type: String(chartType).slice(0, 50),
        format:     String(format).slice(0, 20),
      });
      this._devLog(`Export tracked: ${chartType}/${format}`);
    } catch (err) {
      console.warn('[Tracker] trackExport failed silently:', err.message);
    }
  }

  /* ── Stats fetching ──────────────────────────── */

  /**
   * Fetch aggregated visit stats from the read-only view.
   * Returns null when Supabase is not configured.
   *
   * @returns {Promise<{ unique_visitors: number, total_visits: number, last_visit: string }|null>}
   */
  async getVisitStats() {
    if (!ENABLED) return null;
    try {
      const res  = await this._query('visit_stats', { select: '*', single: true });
      return res;
    } catch {
      return null;
    }
  }

  /* ── Internal ────────────────────────────────── */

  async _insert(table, payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':         SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Supabase insert failed (${res.status}): ${txt}`);
    }
  }

  async _query(table, { select = '*', single = false } = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    const res = await fetch(url, {
      headers: {
        'apikey':         SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        ...(single ? { 'Accept': 'application/vnd.pgrst.object+json' } : {}),
      },
    });
    if (!res.ok) throw new Error(`Supabase query failed (${res.status})`);
    return res.json();
  }

  _devLog(...args) {
    if (this._debug) console.debug('[Tracker]', ...args);
  }
}

/* ─── Session ID ──────────────────────────────── */

/**
 * Get or create a random session ID.
 * Stored in sessionStorage — cleared when the tab closes.
 * Not linked to PII; used only to de-duplicate visit counts.
 */
function getOrCreateSessionId() {
  const key = 'ca_sid';
  let sid   = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

/* ─── Singleton export ────────────────────────── */

/**
 * Singleton tracker instance.
 * Import and call anywhere without re-instantiating.
 *
 * @example
 *   import { tracker } from './tracker.js';
 *   tracker.trackVisit();
 *   tracker.trackExport('line', 'html');
 */
export const tracker = new Tracker();