import { askAnalyst } from './analyst.js';
import { getAiSettings } from './ai-config.js';
import { PROVIDERS, detectProvider } from './ai-providers.js';
import { getChart } from './registry.js';
import { renderChart, destroyInstance } from './engines.js';

/** One in-memory conversation per imported table; provider calls use the shared analyst. */
export function mountMatchChat(root, getTable) {
  const log = root.querySelector('#match-chat-log');
  const form = root.querySelector('#match-chat-form');
  const input = root.querySelector('#match-message');
  const send = root.querySelector('#match-chat-send');
  const stop = root.querySelector('#match-chat-stop');
  const provider = root.querySelector('#match-chat-provider');
  const initialPlaceholder = input.placeholder;
  let history = [];
  let current = null;
  let controller = null;
  let revision = 0;
  const charts = [];
  const selectors = [];

  const bubble = (role, text) => {
    const node = document.createElement('div');
    node.className = 'match-chat-message';
    node.dataset.role = role;
    const label = document.createElement('b');
    label.textContent = role === 'user' ? 'You' : 'Assistant';
    const content = document.createElement('p');
    content.textContent = text;
    node.append(label, content);
    log.append(node);
    return node;
  };
  const busy = (value) => {
    send.disabled = value;
    stop.hidden = !value;
    send.textContent = value ? 'Thinking…' : 'Send';
  };
  const reset = () => {
    revision++;
    controller?.abort();
    controller = null;
    charts.splice(0).forEach(destroyInstance);
    selectors.length = 0;
    history = [];
    current = null;
    input.placeholder = initialPlaceholder;
    log.replaceChildren();
    bubble('assistant', 'Upload or paste a table, then ask me to find insights or draw a chart. You can follow up to change the chart or explore another question.');
    busy(false);
  };
  const submit = async () => {
    const request = input.value.trim();
    if (!request || controller) return;
    const turn = revision;
    const active = new AbortController();
    controller = active;
    busy(true);
    bubble('user', request);
    input.value = '';
    const pending = bubble('assistant', 'Thinking…');
    const timeout = setTimeout(() => active.abort(), 90000);
    try {
      const settings = await getAiSettings();
      if (turn !== revision) return;
      const service = settings.provider === 'auto' ? detectProvider(settings.key) : settings.provider;
      provider.textContent = settings.model || PROVIDERS[service]?.label || 'Add API key';
      const result = await askAnalyst({
        request, conversation: history, table: getTable(),
        def: current && getChart(current.chart), spec: current?.spec,
        chartContext: current && { chart: current.chart, title: current.title, columns: current.columns },
        signal: active.signal,
        onStatus: (message) => {
          if (turn === revision && !active.signal.aborted) pending.querySelector('p').textContent = message;
        },
      });
      if (turn !== revision) return;
      pending.remove();
      if (active.signal.aborted) throw new Error('Request stopped or timed out. You can send your message again.');
      if (!result.ok) throw new Error(result.error);
      const answer = result.answer;
      history.push({ role: 'user', content: request }, { role: 'assistant', content: JSON.stringify({
        message: answer.message, charts: answer.charts.map(({ chart, title, columns }) => ({ chart, title, columns })),
      }) });
      // ponytail: retain twelve messages; add a conversation summary if longer context is needed.
      history = history.slice(-12);
      const reply = bubble('assistant', answer.message);
      for (const chart of answer.charts) {
        const def = getChart(chart.chart);
        const card = document.createElement('section');
        card.className = 'match-chart-card';
        const heading = document.createElement('h3');
        heading.textContent = chart.title;
        const source = document.createElement('p');
        source.className = 'match-chart-source';
        source.textContent = `Source: ${chart.rowCount} uploaded rows · ${chart.columns.map((index) => getTable().headers[index]).join(' / ')}`;
        const host = document.createElement('div');
        host.className = 'match-chat-chart';
        host.setAttribute('aria-label', chart.title);
        const select = document.createElement('button');
        select.type = 'button';
        select.className = 'btn';
        select.textContent = 'Discuss this chart';
        const choose = () => {
          current = chart;
          selectors.forEach((button) => button.setAttribute('aria-pressed', String(button === select)));
          input.placeholder = `Ask about ${chart.title}…`;
        };
        select.addEventListener('click', () => { choose(); input.focus(); });
        selectors.push(select);
        card.append(heading, source, host, select);
        reply.append(card);
        const instance = renderChart(def, host, chart.spec, { height: 280 });
        charts.push(instance);
        choose();
      }
    } catch (error) {
      if (turn !== revision) return;
      pending.remove();
      bubble('assistant', active.signal.aborted ? 'Request stopped or timed out. You can send your message again.' : error.message);
      if (!input.value) input.value = request;
    } finally {
      clearTimeout(timeout);
      if (turn === revision) { controller = null; busy(false); }
    }
  };
  form.addEventListener('submit', (event) => { event.preventDefault(); submit(); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit(); }
  });
  stop.addEventListener('click', () => controller?.abort());
  root.querySelector('#match-chat-clear').addEventListener('click', () => { reset(); input.focus(); });
  root.querySelectorAll('.match-chat-suggestions button').forEach((button) => {
    button.addEventListener('click', () => { input.value = button.textContent; input.focus(); });
  });
  reset();
  return { reset };
}
