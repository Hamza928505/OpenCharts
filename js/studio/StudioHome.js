/** The studio's starting place: data in, chart out, saved work close by. */
import { getChart } from './registry.js';
import { parseTable, toCSV } from './dataio.js';
import { rankCharts, handOff, takeHandOff, clearHandOff } from './DataMatch.js';
import { readDataFile } from './fileimport.js';
import { listSaved, removeSaved, renameSaved, exportShelf, importShelf, whenSaved } from './shelf.js';
import { mountThemeToggle } from './theme.js';
import { ask } from './confirm.js';

const $ = (selector) => document.querySelector(selector);
const element = (tag, className, label) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label != null) node.textContent = label;
  return node;
};

export class StudioHome {
  constructor() {
    this.input = $('#workspace-paste');
    this.status = $('#workspace-data-status');
    this.savedStatus = $('#workspace-saved-status');
    this.suggestions = $('#workspace-suggestions');
    mountThemeToggle($('#hub-theme-mount'));
    this.renderStarters();
    this.renderSaved();

    let timer;
    this.input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.renderData(), 220);
    });
    $('#workspace-file').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      this.status.textContent = `Reading ${file.name}…`;
      const result = await readDataFile(file);
      if (!result.ok) { this.status.textContent = result.message; return; }
      this.input.value = result.text;
      this.renderData();
    });
    $('#workspace-clear').addEventListener('click', () => {
      this.input.value = '';
      clearHandOff();
      this.renderData();
      this.input.focus();
    });
    $('#workspace-export').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([exportShelf()], { type: 'application/json' }));
      const link = element('a');
      link.href = url;
      link.download = `opencharts-my-charts-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      this.savedStatus.textContent = 'Charts exported as a JSON file.';
    });
    $('#workspace-import').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const result = importShelf(await file.text(), { isChart: (id) => Boolean(getChart(id)) });
        this.savedStatus.textContent = result.message;
        this.renderSaved();
      } catch {
        this.savedStatus.textContent = 'Could not read that charts file. Try exporting it again.';
      }
    });

    const held = takeHandOff();
    if (held) {
      this.input.value = toCSV(held.headers, held.rows);
      this.renderData();
    }
  }

  renderStarters() {
    const host = $('#workspace-starters');
    for (const id of ['bar-vertical', 'line-basic', 'pie', 'scatter-basic']) {
      const chart = getChart(id);
      if (!chart) continue;
      const link = element('a', 'workspace-starter');
      link.href = `studio.html?chart=${encodeURIComponent(id)}`;
      link.append(element('strong', null, chart.title), element('span', null, chart.blurb));
      host.append(link);
    }
  }

  renderData() {
    this.suggestions.replaceChildren();
    const raw = this.input.value.trim();
    if (!raw) {
      this.status.textContent = 'Files are read in your browser. Supported: CSV, TSV, JSON, and Excel up to 10 MB.';
      return;
    }
    const table = parseTable(raw);
    if (!table.rows.length) {
      this.status.textContent = 'No readable rows yet. Check the first row and the separator.';
      return;
    }
    this.status.textContent = `${table.rows.length} rows · ${table.headers.length} columns. Choose a chart to continue.`;
    const columns = element('p', 'workspace-columns', `Columns: ${table.headers.join(' · ')}`);
    const title = element('h3', null, 'Charts for this data');
    const ranked = rankCharts(table);
    const candidates = [...ranked.fits, ...ranked.partial].slice(0, 6);
    if (!candidates.length) {
      this.suggestions.append(columns, title, element('p', null, 'No chart reads this table yet. Check its headers or try another shape.'));
      return;
    }
    const list = element('div', 'workspace-recommendations');
    for (const choice of candidates) {
      const button = element('button', 'workspace-recommendation');
      button.type = 'button';
      button.append(element('strong', null, choice.def.title), element('span', null, choice.table ? `Uses: ${choice.table.headers.join(', ')}` : choice.def.category));
      button.addEventListener('click', () => {
        if (!handOff(choice.table || table)) {
          this.status.textContent = 'This browser could not store the table. Try a smaller file or enable browser storage.';
          return;
        }
        location.href = `studio.html?chart=${encodeURIComponent(choice.def.id)}`;
      });
      list.append(button);
    }
    this.suggestions.append(columns, title, list);
  }

  renderSaved() {
    const host = $('#workspace-saved-list');
    host.replaceChildren();
    const saved = listSaved().filter((entry) => getChart(entry.chart));
    $('#workspace-saved-count').textContent = String(saved.length);
    $('#workspace-export').disabled = saved.length === 0;
    if (!saved.length) {
      host.append(element('p', 'workspace-empty', 'No charts saved yet. Open a chart and press Save to keep it here.'));
      return;
    }
    for (const entry of saved) {
      const chart = getChart(entry.chart);
      const row = element('article', 'workspace-saved-item');
      const link = element('a', 'workspace-saved-link');
      link.href = `studio.html?chart=${encodeURIComponent(entry.chart)}&saved=${encodeURIComponent(entry.id)}`;
      link.append(element('strong', null, entry.name || chart.title), element('span', null, `${chart.title} · ${whenSaved(entry.updatedAt)}`));
      const actions = element('div', 'workspace-saved-actions');
      const rename = element('button', 'btn btn-sm', 'Rename');
      rename.type = 'button';
      rename.addEventListener('click', () => {
        const input = element('input', 'workspace-rename');
        input.value = entry.name || chart.title;
        input.setAttribute('aria-label', 'Chart name');
        link.replaceWith(input);
        input.focus();
        input.select();
        let done = false;
        const finish = (commit) => {
          if (done) return;
          done = true;
          if (commit) {
            renameSaved(entry.id, input.value);
            this.savedStatus.textContent = 'Chart renamed.';
          }
          this.renderSaved();
        };
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') finish(true);
          if (event.key === 'Escape') finish(false);
        });
        input.addEventListener('blur', () => finish(true));
      });
      const remove = element('button', 'btn btn-sm', 'Remove');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        const yes = await ask({ title: `Remove “${entry.name || chart.title}”?`, text: 'This saved chart is stored only in this browser.', tone: 'warn', confirm: 'Remove it', cancel: 'Keep it' });
        if (yes) { removeSaved(entry.id); this.savedStatus.textContent = 'Chart removed from this browser.'; this.renderSaved(); }
      });
      actions.append(rename, remove);
      row.append(link, actions);
      host.append(row);
    }
  }
}
