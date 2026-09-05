/**
 * ai-config.js — handles the API key configuration for the AI Analyst.
 */

import { toast } from './toast.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// Keep it in memory if they don't want to save to localStorage
let sessionApiKey = null;

const STORAGE_KEY = 'opencharts.ai-key';

export function getStoredApiKey() {
  if (sessionApiKey) return sessionApiKey;
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch (e) {
    return null;
  }
}

export function openAiConfigDialog() {
  return new Promise((resolve) => {
    const scrim = el('div', 'dlg-scrim ask-scrim');
    const box = el('div', 'ask');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');

    const icon = el('div', 'ask-icon');
    icon.textContent = '🤖';
    icon.setAttribute('aria-hidden', 'true');

    const main = el('div', 'ask-main');
    main.appendChild(el('h2', 'ask-title', 'AI Analyst Configuration'));
    main.appendChild(el('p', 'ask-text', 'Enter your LLM API Key (e.g. Gemini, OpenAI) to enable AI data analysis. Your key is used directly from your browser.'));

    const inputWrap = el('div', 'dlg-col');
    inputWrap.style.marginTop = '16px';
    const input = el('input', 'link-input');
    input.type = 'password';
    input.placeholder = 'sk-...';
    input.value = getStoredApiKey() || '';
    input.style.width = '100%';
    input.style.marginBottom = '12px';
    inputWrap.appendChild(input);

    const checkboxWrap = el('label', 'shape-col');
    checkboxWrap.style.display = 'flex';
    checkboxWrap.style.alignItems = 'center';
    checkboxWrap.style.gap = '8px';
    checkboxWrap.style.cursor = 'pointer';
    const checkbox = el('input');
    checkbox.type = 'checkbox';
    // Check it if they already have one in localStorage
    checkbox.checked = !!localStorage.getItem(STORAGE_KEY);
    checkboxWrap.append(checkbox, el('span', null, 'Save this key in localStorage (Not recommended for shared devices)'));
    inputWrap.appendChild(checkboxWrap);

    main.appendChild(inputWrap);

    const foot = el('div', 'ask-foot');
    foot.style.marginTop = '24px';
    
    const cancelBtn = el('button', 'btn', 'Cancel');
    cancelBtn.type = 'button';
    
    const clearBtn = el('button', 'btn', 'Clear Key');
    clearBtn.type = 'button';
    clearBtn.style.marginRight = 'auto';

    const saveBtn = el('button', 'btn btn-primary', 'Save Key');
    saveBtn.type = 'button';
    
    foot.append(clearBtn, cancelBtn, saveBtn);
    main.appendChild(foot);

    box.append(icon, main);
    scrim.appendChild(box);
    document.body.appendChild(scrim);

    const done = (value) => {
      document.removeEventListener('keydown', onKey, true);
      scrim.remove();
      resolve(value);
    };

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
    }

    cancelBtn.addEventListener('click', () => done(false));
    clearBtn.addEventListener('click', () => {
      sessionApiKey = null;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      input.value = '';
      toast('API Key cleared', 'ok');
    });

    saveBtn.addEventListener('click', () => {
      const key = input.value.trim();
      if (!key) {
        toast('Please enter a valid key or click Clear', 'warn');
        return;
      }
      
      sessionApiKey = key;
      if (checkbox.checked) {
        try {
          localStorage.setItem(STORAGE_KEY, key);
        } catch (e) {
          toast('Could not save to localStorage', 'warn');
        }
      } else {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
      }
      
      toast('API Key saved', 'ok');
      done(true);
    });

    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) done(false); });
    document.addEventListener('keydown', onKey, true);
    
    // Focus input on load
    setTimeout(() => input.focus(), 50);
  });
}

