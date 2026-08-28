/**
 * CodePanel.js — the HTML / CSS / JS / Standalone / AI Prompt viewer.
 *
 * Holds all five generated views, renders the active one with line numbers and
 * syntax colouring, and owns the copy and download actions.
 *
 * The prompt is prose rather than code, so it is the one tab that wraps and
 * drops the line numbers — numbering a paragraph helps nobody, and `pre` would
 * push every sentence off the right-hand edge.
 */

import { highlight } from './highlight.js';
import { toast } from './toast.js';
import { PROMPT_MODES, readPromptMode, writePromptMode } from './prompt.js';

const TABS = [
  { id: 'html',       label: 'HTML',       lang: 'html' },
  { id: 'css',        label: 'CSS',        lang: 'css'  },
  { id: 'js',         label: 'JS',         lang: 'js'   },
  { id: 'standalone', label: 'Standalone', lang: 'html' },
  // `lang: 'text'` is not a highlighter — it is the fallthrough, which escapes
  // and returns the source untouched.
  { id: 'prompt',     label: 'AI Prompt',  lang: 'text', prose: true },
];

/** What the copy toast calls each view. */
const COPIED = {
  standalone: 'Standalone page',
  prompt: 'Prompt',
};

const PROMPT_LEAD = 'Copy this, then attach your own spreadsheet or CSV to any AI assistant. ';

export class CodePanel {
  /**
   * @param {HTMLElement} root  the .codepanel element
   */
  constructor(root) {
    this.root = root;
    this.active = 'html';
    this.code = { html: '', css: '', js: '', standalone: '', prompt: '', promptShort: '' };
    this.filename = 'chart';
    this._build();
  }

  _build() {
    this.root.innerHTML = '';

    const bar = document.createElement('div');
    bar.className = 'code-bar';

    this.tabButtons = TABS.map((tab) => {
      const b = document.createElement('button');
      b.className = 'tab' + (tab.id === this.active ? ' active' : '');
      b.type = 'button';
      b.textContent = tab.label;
      b.dataset.tab = tab.id;
      b.addEventListener('click', () => this.show(tab.id));
      bar.appendChild(b);
      return b;
    });

    const actions = document.createElement('div');
    actions.className = 'code-actions';

    // Which prompt the reader wants is a property of the reader, not of the
    // chart, so it is remembered — and the gallery tiles read the same answer.
    this.promptMode = readPromptMode();
    this.modeSwitch = document.createElement('div');
    this.modeSwitch.className = 'prompt-modes';
    this.modeSwitch.setAttribute('role', 'group');
    this.modeSwitch.setAttribute('aria-label', 'How much the prompt should carry');
    this.modeButtons = PROMPT_MODES.map((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'prompt-mode' + (m.id === this.promptMode ? ' active' : '');
      b.textContent = m.label;
      b.dataset.mode = m.id;
      b.title = m.note;
      b.setAttribute('aria-pressed', String(m.id === this.promptMode));
      b.addEventListener('click', () => this.setPromptMode(m.id));
      this.modeSwitch.appendChild(b);
      return b;
    });
    actions.appendChild(this.modeSwitch);

    this.copyBtn = document.createElement('button');
    this.copyBtn.className = 'btn btn-sm';
    this.copyBtn.type = 'button';
    this.copyBtn.innerHTML = '<span aria-hidden="true">⧉</span> Copy';
    this.copyBtn.addEventListener('click', () => this.copy());

    this.dlBtn = document.createElement('button');
    this.dlBtn.className = 'btn btn-sm';
    this.dlBtn.type = 'button';
    this.dlBtn.innerHTML = '<span aria-hidden="true">↓</span> Download .html';
    this.dlBtn.addEventListener('click', () => this.download());

    actions.append(this.copyBtn, this.dlBtn);
    bar.appendChild(actions);

    const scroll = document.createElement('div');
    scroll.className = 'code-scroll';
    this.gutter = document.createElement('div');
    this.gutter.className = 'gutter';
    this.body = document.createElement('pre');
    this.body.className = 'code-body';
    scroll.append(this.gutter, this.body);

    this.note = document.createElement('div');
    this.note.className = 'code-note';

    this.root.append(bar, scroll, this.note);
    this.scroll = scroll;
  }

  /**
   * Load a fresh set of generated views.
   * @param {{html:string,css:string,js:string,standalone:string,prompt:string,promptShort:string,note:string}} code
   * @param {string} filename  base name for the download
   */
  setCode(code, filename) {
    this.code = code;
    this.filename = filename || 'chart';
    this._paint();
  }

  /** What the given tab is currently showing. The prompt has two forms. */
  _srcFor(tabId) {
    if (tabId !== 'prompt') return this.code[tabId] || '';
    return (this.promptMode === 'data' ? this.code.promptShort : this.code.prompt) || '';
  }

  /**
   * The prompt in whichever form is selected.
   *
   * The stage bar copies it without opening the tab, so the Full/Data only
   * choice has to be resolved in one place rather than guessed at twice.
   */
  promptText() {
    return this._srcFor('prompt');
  }

  setPromptMode(mode) {
    this.promptMode = mode;
    writePromptMode(mode);
    this.modeButtons.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    this._paint();
  }

  show(tabId) {
    this.active = tabId;
    this.tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
    this._paint();
    this.scroll.scrollTop = 0;
  }

  _paint() {
    const tab = TABS.find((t) => t.id === this.active) || TABS[0];
    const src = this._srcFor(this.active);

    this.body.innerHTML = highlight(src, tab.lang);
    this.body.classList.toggle('prose', !!tab.prose);

    // Line numbers down the side of a paragraph are noise, so the prose tab
    // has no gutter at all rather than an empty one taking up its rule.
    this.gutter.hidden = !!tab.prose;
    this.gutter.innerHTML = '';
    if (!tab.prose) {
      const lines = src.split('\n').length;
      const frag = document.createDocumentFragment();
      for (let i = 1; i <= lines; i++) {
        const s = document.createElement('span');
        s.textContent = String(i);
        frag.appendChild(s);
      }
      this.gutter.appendChild(frag);
    }

    this.modeSwitch.hidden = !tab.prose;

    // The dependency note under the code answers "what else does this need?",
    // which is not the question the prompt tab leaves you with.
    const mode = PROMPT_MODES.find((m) => m.id === this.promptMode) || PROMPT_MODES[0];
    this.note.textContent = tab.prose ? PROMPT_LEAD + mode.note : (this.code.note || '');

    // Downloading only makes sense for the complete document.
    this.dlBtn.style.display = this.active === 'standalone' ? '' : 'none';
  }

  async copy() {
    const src = this._srcFor(this.active);
    try {
      await navigator.clipboard.writeText(src);
      this.copyBtn.innerHTML = '<span aria-hidden="true">✓</span> Copied';
      setTimeout(() => { this.copyBtn.innerHTML = '<span aria-hidden="true">⧉</span> Copy'; }, 1800);
      toast(`${COPIED[this.active] || this.active.toUpperCase()} copied`, 'ok');
    } catch {
      // Clipboard API needs a secure context; select the text so Ctrl+C works.
      const range = document.createRange();
      range.selectNodeContents(this.body);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast('Clipboard blocked — text selected, press Ctrl+C', 'bad');
    }
  }

  download() {
    const blob = new Blob([this.code.standalone || ''], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.filename}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`${this.filename}.html downloaded`, 'ok');
  }
}
