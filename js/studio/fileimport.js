/**
 * fileimport.js — read a .csv, .txt or .xlsx into the same CSV text the paste
 * tab produces, so everything downstream stays on one parsing path.
 *
 * ── Why there is no library here ─────────────────────────────────────────
 * An .xlsx is a ZIP of XML. Both formats have had native browser support for
 * years — `DecompressionStream` and `DOMParser` — so a spreadsheet reader is
 * about two hundred lines rather than the 1MB a general-purpose one costs.
 * That also keeps the site's promise: no build step, no runtime dependency.
 *
 * ── The threat model ─────────────────────────────────────────────────────
 * A chart library reads files people were sent by someone else. The file is
 * hostile until proven otherwise, and every check below exists because of a
 * specific way this could go wrong:
 *
 *   1. **Nothing leaves the browser.** The file is never uploaded, and no
 *      network request is made while reading it. It cannot be exfiltrated by
 *      a page that never sends it anywhere.
 *   2. **The bytes decide the format, not the name.** `sniff()` reads the
 *      magic number. `sales.csv` that is really a ZIP is refused, and so is
 *      `sales.xlsx` that is really something else.
 *   3. **Old .xls is refused by name, not by accident.** It is a compound
 *      binary document that can carry macros; it is recognised precisely so
 *      the message can say "save it as .xlsx" instead of failing obscurely.
 *   4. **Zip bombs cannot run us out of memory.** The archive, each entry,
 *      the total inflated size and the entry count are all capped, and a
 *      declared size that disagrees with reality aborts the read.
 *   5. **Only three paths are ever read** out of the archive, matched
 *      exactly. A crafted entry name — `../../etc/passwd`, an absolute path,
 *      a very long one — matches nothing and is skipped.
 *   6. **No XXE.** The XML goes through `DOMParser` as `application/xml`,
 *      which does not resolve external entities in any browser. A file with a
 *      DOCTYPE is refused anyway, since a spreadsheet has no business having
 *      one.
 *   7. **Formulas are never evaluated.** Only the cached value of a cell is
 *      read. `=WEBSERVICE(...)` is inert; the sheet is data, not code.
 *   8. **Nothing is ever injected as markup.** Cell text reaches the page
 *      through `textContent` and `input.value`, never `innerHTML`.
 *
 * ── And one thing the magic numbers cannot do ───────────────────────────
 * There is no signature that separates text-which-is-CSV from text-which-is
 * SQL: both are just characters. A .sql saved as .txt passes every byte-level
 * check there is, because it genuinely *is* text. So the last gate reads the
 * content — see `looksLikeTable()` in dataio.js. That one is not about safety
 * (SQL text here is inert: never run, never sent, never inserted as markup);
 * it is about not drawing a chart out of a file that was never data.
 */

import { looksLikeTable } from './dataio.js';

/** 10MB. Comfortably more than any hand-made spreadsheet, and a hard ceiling. */
const MAX_FILE = 10 * 1024 * 1024;
/** What the three XML parts may inflate to in total. */
const MAX_INFLATED = 40 * 1024 * 1024;
/** A real .xlsx has tens of entries. Thousands means something else. */
const MAX_ENTRIES = 2048;
/** Enough to draw anything; a guard against a sheet with a million blank rows. */
const MAX_ROWS = 20000;
const MAX_COLS = 512;

const err = (message) => ({ ok: false, message });

/* ── format sniffing ─────────────────────────────────────────────────────── */

const startsWith = (bytes, sig) => sig.every((b, i) => bytes[i] === b);

/**
 * What this file actually is, from its first bytes.
 * @returns {'zip'|'ole'|'text'|'binary'}
 */
function sniff(bytes) {
  // PK\x03\x04, and the two variants a zip writer may emit.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
    || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])
    || startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])) return 'zip';

  // Compound File Binary — .xls, .doc, .msg. Recognised so we can say so.
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';

  // Anything with a NUL in the first 8KB is not a text table. This is also
  // what stops an executable or an image being read as if it were a CSV.
  const head = bytes.subarray(0, 8192);
  for (let i = 0; i < head.length; i++) {
    if (head[i] === 0x00) return 'binary';
  }
  return 'text';
}

/* ── ZIP reading ─────────────────────────────────────────────────────────── */

/**
 * The entries of a ZIP, read from its central directory.
 *
 * The central directory is authoritative — walking local headers instead is
 * how a crafted archive gets a reader to disagree with every other tool about
 * what is inside it.
 */
function readZipDirectory(view, bytes) {
  // The end-of-central-directory record sits in the last 64KB.
  const from = Math.max(0, bytes.length - 66_000);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= from; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a readable .xlsx — no ZIP directory found');

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (count > MAX_ENTRIES) throw new Error('that .xlsx has an implausible number of parts');

  const entries = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length) break;
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const inflated = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localAt = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLen));

    entries.push({ name, method, compressed, inflated, localAt });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Inflate one entry, refusing anything that does not match what it declared. */
async function readEntry(view, bytes, entry) {
  if (entry.inflated > MAX_INFLATED) {
    throw new Error('that .xlsx expands to far more than a spreadsheet should');
  }
  const at = entry.localAt;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) {
    throw new Error('that .xlsx is damaged — a part is not where the index says');
  }
  const nameLen = view.getUint16(at + 26, true);
  const extraLen = view.getUint16(at + 28, true);
  const start = at + 30 + nameLen + extraLen;
  const end = start + entry.compressed;
  if (end > bytes.length) throw new Error('that .xlsx is truncated');

  const raw = bytes.subarray(start, end);
  if (entry.method === 0) return new TextDecoder().decode(raw);
  if (entry.method !== 8) throw new Error('that .xlsx uses a compression this reader does not support');

  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const out = await new Response(stream).arrayBuffer();
  if (out.byteLength > MAX_INFLATED) {
    throw new Error('that .xlsx expands to far more than a spreadsheet should');
  }
  return new TextDecoder().decode(out);
}

/* ── XLSX ────────────────────────────────────────────────────────────────── */

/** Parse XML safely, and refuse anything carrying a DOCTYPE. */
function parseXml(text, what) {
  // A spreadsheet part has no legitimate reason to declare a DOCTYPE, and
  // refusing outright is simpler to reason about than trusting the parser.
  if (/<!DOCTYPE/i.test(text.slice(0, 2048))) {
    throw new Error(`that .xlsx has a DOCTYPE in its ${what}, which a spreadsheet should not`);
  }
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
  const doc = new DOMParser().parseFromString(escaped, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(`that .xlsx has unreadable ${what}`);
  return doc;
}

/** "BC12" → 54 (zero-based column index). */
function columnOf(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

async function readXlsx(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries = readZipDirectory(view, bytes);

  const find = (name) => entries.find((e) => e.name === name);

  // Which sheet is first in the workbook's own order, rather than assuming
  // sheet1.xml — Excel does not renumber when sheets are deleted or moved.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wbEntry = find('xl/workbook.xml');
  const relsEntry = find('xl/_rels/workbook.xml.rels');
  if (wbEntry && relsEntry) {
    try {
      const wb = parseXml(await readEntry(view, bytes, wbEntry), 'workbook');
      const rels = parseXml(await readEntry(view, bytes, relsEntry), 'workbook relationships');
      const firstSheet = wb.querySelector('sheets > sheet');
      const relId = firstSheet && (firstSheet.getAttribute('r:id') || firstSheet.getAttribute('id'));
      if (relId) {
        const rel = [...rels.getElementsByTagName('Relationship')]
          .find((r) => r.getAttribute('Id') === relId);
        const target = rel && rel.getAttribute('Target');
        // Only a plain relative path inside xl/ is accepted; anything with a
        // scheme, a leading slash or a `..` segment is ignored.
        if (target && /^[\w./-]+$/.test(target) && !target.includes('..') && !target.startsWith('/')) {
          sheetPath = target.startsWith('xl/') ? target : 'xl/' + target.replace(/^\.\//, '');
        }
      }
    } catch { /* fall back to sheet1.xml */ }
  }

  const sheetEntry = find(sheetPath) || find('xl/worksheets/sheet1.xml');
  if (!sheetEntry) throw new Error('that .xlsx has no readable worksheet');

  // Shared strings hold most cell text; a sheet of numbers has no such part.
  let shared = [];
  const ssEntry = find('xl/sharedStrings.xml');
  if (ssEntry) {
    const doc = parseXml(await readEntry(view, bytes, ssEntry), 'shared strings');
    shared = [...doc.getElementsByTagName('si')].map((si) => {
      // Runs of differently-formatted text inside one cell.
      const runs = si.getElementsByTagName('t');
      let out = '';
      for (const t of runs) out += t.textContent;
      return out;
    });
  }

  const sheet = parseXml(await readEntry(view, bytes, sheetEntry), 'worksheet');
  const rows = [];
  for (const row of sheet.getElementsByTagName('row')) {
    if (rows.length >= MAX_ROWS) break;
    const cells = [];
    for (const c of row.getElementsByTagName('c')) {
      const ref = c.getAttribute('r') || '';
      const at = ref ? columnOf(ref) : cells.length;
      if (at < 0 || at >= MAX_COLS) continue;

      const type = c.getAttribute('t');
      let value = '';
      if (type === 'inlineStr') {
        const t = c.getElementsByTagName('t')[0];
        value = t ? t.textContent : '';
      } else {
        // `v` is the cached value. A cell may also carry an `f` formula; it is
        // deliberately never read, let alone evaluated.
        const v = c.getElementsByTagName('v')[0];
        const text = v ? v.textContent : '';
        if (type === 's') value = shared[Number(text)] ?? '';
        else if (type === 'b') value = text === '1' ? 'TRUE' : 'FALSE';
        else if (type === 'e') value = '';        // #REF!, #DIV/0! and friends
        else value = text;
      }
      while (cells.length < at) cells.push('');
      cells[at] = value;
    }
    rows.push(cells);
  }

  // Trailing empty rows and columns are an artefact of how sheets are saved.
  while (rows.length && !rows[rows.length - 1].some((c) => String(c).trim())) rows.pop();
  if (!rows.length) throw new Error('that sheet is empty');

  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => {
    const padded = [...r];
    while (padded.length < width) padded.push('');
    return padded.map(csvCell).join(',');
  }).join('\n');
}

/** Quote a cell for CSV. */
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* ── the entry point ─────────────────────────────────────────────────────── */

/**
 * Read a user's file into CSV text.
 *
 * @param {File} file
 * @returns {Promise<{ok: true, text: string, kind: string} | {ok: false, message: string}>}
 */
export async function readDataFile(file) {
  if (!file) return err('No file chosen.');
  if (file.size === 0) return err('That file is empty.');
  if (file.size > MAX_FILE) {
    return err(`That file is ${(file.size / 1048576).toFixed(1)}MB. The limit is 10MB — `
      + 'a chart that needs more than that wants a database, not a spreadsheet.');
  }

  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return err('That file could not be read. It may have been moved or deleted.');
  }

  const bytes = new Uint8Array(buffer);
  const kind = sniff(bytes);
  const name = (file.name || '').toLowerCase();
  const looksXlsx = name.endsWith('.xlsx') || name.endsWith('.xlsm');

  if (kind === 'ole') {
    return err('That is an old .xls file, which this reader does not open. '
      + 'Open it in Excel or Sheets and save as .xlsx or .csv.');
  }

  if (kind === 'zip') {
    // The bytes say ZIP. Refuse to guess that any ZIP is a spreadsheet.
    if (!looksXlsx) {
      return err('That file is a ZIP archive, not a table. If it is a spreadsheet, '
        + 'give it an .xlsx extension; otherwise unpack it first.');
    }
    try {
      const text = await readXlsx(buffer);
      return { ok: true, text, kind: 'xlsx' };
    } catch (e) {
      return err(e.message || 'That .xlsx could not be read.');
    }
  }

  if (kind === 'binary') {
    return err('That file is not text. CSV, TSV, plain text and .xlsx are the formats this reads.');
  }

  // The name says spreadsheet but the bytes say text — trust the bytes, and
  // say so, because a mislabelled file is worth knowing about.
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
  if (!text.trim()) return err('That file has no rows in it.');

  // Being text is not the same as being a table. There is no magic number for
  // that — CSV and SQL are both just characters — so the content has to be
  // read. Without this a .sql saved as .txt was split on whitespace into a
  // grid of fragments and drawn.
  const shape = looksLikeTable(text);
  if (!shape.ok) return err(shape.message);

  return {
    ok: true,
    text,
    kind: looksXlsx ? 'text (despite the .xlsx name)' : 'text',
  };
}

/** Everything this accepts, for an <input accept="…">. */
export const ACCEPTED = '.csv,.tsv,.txt,.xlsx,.xlsm,text/csv,text/plain,'
  + 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Ask for a file and hand back whatever the reader made of it.
 *
 * The input is created, clicked and thrown away per call. A long-lived one
 * would need clearing between uses — choosing the same file twice fires no
 * `change` event — and that is exactly the kind of state worth not having.
 *
 * Resolves to `null` if the dialog is dismissed. There is no reliable cancel
 * event across browsers, so the caller simply never hears back; nothing is
 * left running, and the next call starts fresh.
 *
 * @returns {Promise<{ok: boolean, text?: string, kind?: string, message?: string, name?: string} | null>}
 */
export function chooseDataFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED;
    input.style.cssText = 'position:fixed;left:-9999px;width:0;height:0';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) { resolve(null); return; }
      const res = await readDataFile(file);
      resolve({ ...res, name: file.name });
    }, { once: true });

    input.click();
  });
}
