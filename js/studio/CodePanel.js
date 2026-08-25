/**
 * CodePanel.js — the HTML / CSS / JS / Standalone viewer.
 *
 * Holds all four generated views, renders the active one with line numbers and
 * syntax colouring, and owns the copy and download actions.
 */

import { highlight } from './highlight.js';
import { toast } from './toast.js';

const TABS = [
  { id: 'html',       label: 'HTML',       lang: 'html' },
  { id: 'css',        label: 'CSS',        lang: 'css'  },
  { id: 'js',         label: 'JS',         lang: 'js'   },
  { id: 'standalone', label: 'Standalone', lang: 'html' },
];

export class CodePanel {
  /**
   * @param {HTMLElement} root  the .codepanel element
   */
  constructor(root) {
    this.root = root;
    this.active = 'html';
    this.code = { html: '', css: '', js: '', standalone: '' };
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
   * @param {{html:string,css:string,js:string,standalone:string,note:string}} code
   * @param {string} filename  base name for the download
   */
  setCode(code, filename) {
    this.code = code;
    this.filename = filename || 'chart';
    this.note.textContent = code.note || '';
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
    const src = this.code[this.active] || '';

    this.body.innerHTML = highlight(src, tab.lang);

    const lines = src.split('\n').length;
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= lines; i++) {
      const s = document.createElement('span');
      s.textContent = String(i);
      frag.appendChild(s);
    }
    this.gutter.innerHTML = '';
    this.gutter.appendChild(frag);

    // Downloading only makes sense for the complete document.
    this.dlBtn.style.display = this.active === 'standalone' ? '' : 'none';
  }

  async copy() {
    const src = this.code[this.active] || '';
    try {
      await navigator.clipboard.writeText(src);
      this.copyBtn.innerHTML = '<span aria-hidden="true">✓</span> Copied';
      setTimeout(() => { this.copyBtn.innerHTML = '<span aria-hidden="true">⧉</span> Copy'; }, 1800);
      toast(`${this.active === 'standalone' ? 'Standalone page' : this.active.toUpperCase()} copied`, 'ok');
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
