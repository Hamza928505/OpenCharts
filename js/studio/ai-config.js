/**
 * ai-config.js — where the AI Analyst's API key is kept.
 *
 * This module and its button were removed once, because nothing read the key
 * back: a reader was being asked to hand over a credential to a feature that
 * did not exist. It comes back now with `analyst.js` behind it, and the suite
 * holds the rule that removal established — the control exists only while
 * something consumes it, which is checked by requiring a caller for
 * `getStoredApiKey` outside this file.
 *
 * **"Encrypted" here means obfuscated, and the dialog says so.** The key is
 * AES-GCM sealed under a passphrase that is a constant in this file, so
 * anything that can read the page can derive it. What that buys is real but
 * narrow: a key does not sit in `localStorage` as plain text where a glance at
 * devtools, a screen share or a synced profile would show it. It is not a
 * secret store, and a browser is not one. The honest alternative — keeping the
 * key in memory for the session only — is the unticked default here.
 *
 * The key is sent only to the provider the reader chooses. It never enters a
 * spec, share link or export.
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
let sessionSettings = null;

const STORAGE_KEY = 'opencharts.ai-key';
const SETTINGS_KEY = 'opencharts.ai-settings';
const ENC_PREFIX = 'enc:v1:';
const PASSPHRASE = 'opencharts-ai-config-local';

const DEFAULT_SETTINGS = {
  provider: 'anthropic',
  endpoint: 'http://localhost:11434/v1/chat/completions',
  model: '',
};

function normaliseSettings(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    provider: ['anthropic', 'openai', 'gemini'].includes(raw.provider) ? raw.provider : 'anthropic',
    endpoint: String(raw.endpoint || DEFAULT_SETTINGS.endpoint).trim(),
    model: String(raw.model || '').trim(),
  };
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveAesKey(salt) {
  const material = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(PASSPHRASE),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptForStorage(plainText) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(salt);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(plainText)
  );
  return ENC_PREFIX + [bytesToBase64(salt), bytesToBase64(iv), bytesToBase64(new Uint8Array(cipherBuf))].join(':');
}

async function decryptFromStorage(payload) {
  if (!payload) return null;
  if (!payload.startsWith(ENC_PREFIX)) return null;
  const parts = payload.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) return null;
  const salt = base64ToBytes(parts[0]);
  const iv = base64ToBytes(parts[1]);
  const data = base64ToBytes(parts[2]);
  const key = await deriveAesKey(salt);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return textDecoder.decode(plainBuf);
}

export async function getStoredApiKey() {
  if (sessionApiKey) return sessionApiKey;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return await decryptFromStorage(stored);
  } catch (e) {
    return null;
  }
}

/** The provider choice is browser preference data; its key remains sealed separately. */
export async function getAiSettings() {
  if (!sessionSettings) {
    try {
      sessionSettings = normaliseSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'));
    } catch (e) {
      sessionSettings = { ...DEFAULT_SETTINGS };
    }
  }
  return { ...sessionSettings, key: await getStoredApiKey() };
}

/**
 * Put a key in place, for the session or for this browser.
 *
 * The dialog is not the only caller that should exist — the suite needs to seed
 * one without typing into a modal — and a second path that wrote storage its
 * own way would be a second idea of what "stored" means. Everything that sets
 * a key goes through here.
 *
 * @param {string} key
 * @param {{ persist?: boolean }} [opts]  persist: keep it between visits
 */
export async function setApiKey(key, { persist = false } = {}) {
  const value = String(key || '').trim();
  sessionApiKey = value || null;
  if (!value || !persist) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* not fatal */ }
    return { ok: true, persisted: false };
  }
  try {
    localStorage.setItem(STORAGE_KEY, await encryptForStorage(value));
    return { ok: true, persisted: true };
  } catch (e) {
    // The key still works for this session; it just will not be remembered.
    return { ok: false, persisted: false, message: e.message };
  }
}

/** Save an Anthropic, Gemini, or OpenAI-compatible/local provider selection. */
export async function setAiSettings(settings, { persist = false } = {}) {
  sessionSettings = normaliseSettings(settings);
  const result = await setApiKey(settings && settings.key, { persist });
  try {
    if (persist) localStorage.setItem(SETTINGS_KEY, JSON.stringify(sessionSettings));
    else localStorage.removeItem(SETTINGS_KEY);
  } catch (e) {
    return { ok: false, persisted: false, message: e.message };
  }
  return result.ok ? { ...result, persisted: persist } : result;
}

/** Forget it, in memory and on disk. */
export function clearApiKey() {
  sessionApiKey = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* not fatal */ }
}

export function clearAiSettings() {
  sessionSettings = { ...DEFAULT_SETTINGS };
  clearApiKey();
  try { localStorage.removeItem(SETTINGS_KEY); } catch (e) { /* not fatal */ }
}

/** Whether a key is persisted in localStorage. Storage access can throw. */
function hasPersistedKey() {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return false;
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
    main.appendChild(el('h2', 'ask-title', 'AI Analyst — choose a provider'));
    main.appendChild(el('p', 'ask-text',
      'The AI Analyst calls your selected provider straight from this page — '
      + 'there is no server in this project to route it through, so the key is yours '
      + 'and the requests are billed to you.'));

    const inputWrap = el('div', 'dlg-col');
    inputWrap.style.marginTop = '16px';
    const provider = el('select', 'input');
    provider.setAttribute('aria-label', 'AI provider');
    [['anthropic', 'Anthropic API key'], ['gemini', 'Gemini API key'], ['openai', 'OpenAI-compatible or local model']]
      .forEach(([value, label]) => {
        const option = el('option', null, label);
        option.value = value;
        provider.appendChild(option);
      });
    inputWrap.append(el('label', 'dlg-label', 'Provider'), provider);

    const endpoint = el('input', 'link-input');
    endpoint.type = 'url';
    endpoint.spellcheck = false;
    endpoint.setAttribute('aria-label', 'OpenAI-compatible endpoint');
    endpoint.style.width = '100%';
    const endpointLabel = el('label', 'dlg-label', 'Endpoint');
    endpointLabel.style.marginTop = '12px';

    const model = el('input', 'link-input');
    model.type = 'text';
    model.spellcheck = false;
    model.setAttribute('aria-label', 'Model name');
    model.style.width = '100%';
    const modelLabel = el('label', 'dlg-label', 'Model (optional)');
    modelLabel.style.marginTop = '12px';
    const input = el('input', 'link-input');
    input.type = 'password';
    input.placeholder = 'sk-ant-…';
    input.setAttribute('aria-label', 'Anthropic API key');
    input.value = '';
    getStoredApiKey().then((storedKey) => {
      if (storedKey) input.value = storedKey;
    }).catch(() => {});
    input.style.width = '100%';
    input.style.marginBottom = '12px';
    inputWrap.append(endpointLabel, endpoint, modelLabel, model, input);

    const paintProvider = () => {
      const local = provider.value === 'openai';
      endpointLabel.hidden = endpoint.hidden = !local;
      modelLabel.hidden = model.hidden = provider.value === 'gemini';
      input.placeholder = provider.value === 'anthropic' ? 'sk-ant-â€¦' : provider.value === 'gemini' ? 'AIzaâ€¦' : 'optional';
      model.placeholder = local ? 'llama3.2' : 'Use the default model';
      input.setAttribute('aria-label', provider.value === 'gemini' ? 'Gemini API key' : local ? 'API key (optional)' : 'Anthropic API key');
    };
    provider.addEventListener('change', () => { model.value = ''; paintProvider(); });
    getAiSettings().then((settings) => {
      provider.value = settings.provider;
      endpoint.value = settings.endpoint;
      model.value = settings.provider === 'gemini' ? '' : settings.model;
      input.value = settings.key || '';
      paintProvider();
    }).catch(paintProvider);
    paintProvider();

    const checkboxWrap = el('label', 'shape-col');
    checkboxWrap.style.display = 'flex';
    checkboxWrap.style.alignItems = 'center';
    checkboxWrap.style.gap = '8px';
    checkboxWrap.style.cursor = 'pointer';
    const checkbox = el('input');
    checkbox.type = 'checkbox';
    // Check it if they already have one in localStorage
    checkbox.checked = hasPersistedKey();
    checkboxWrap.append(checkbox, el('span', null,
      'Keep it on this browser between visits. Stored sealed rather than in plain '
      + 'text, under a passphrase this page carries — that hides it from a glance, '
      + 'not from anyone who can read the page. Leave it unticked on a shared machine '
      + 'and the key lives in memory for this session only.'));
    inputWrap.appendChild(checkboxWrap);

    main.appendChild(inputWrap);

    const foot = el('div', 'ask-foot');
    foot.style.marginTop = '24px';
    
    const cancelBtn = el('button', 'btn', 'Cancel');
    cancelBtn.type = 'button';
    
    const clearBtn = el('button', 'btn', 'Clear provider');
    clearBtn.type = 'button';
    clearBtn.style.marginRight = 'auto';

    const saveBtn = el('button', 'btn btn-primary', 'Save provider');
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
      clearAiSettings();
      input.value = '';
      toast('AI provider cleared', 'ok');
    });

    saveBtn.addEventListener('click', async () => {
      const key = input.value.trim();
      if (provider.value !== 'openai' && !key) {
        toast('Enter an API key, or choose a local OpenAI-compatible model.', 'bad');
        return;
      }
      if (provider.value === 'openai' && !endpoint.value.trim()) {
        toast('Enter an OpenAI-compatible endpoint.', 'bad');
        return;
      }
      
      const res = await setAiSettings({
        provider: provider.value,
        endpoint: endpoint.value,
        model: provider.value === 'gemini' ? '' : model.value,
        key,
      }, { persist: checkbox.checked });
      if (!res.ok) {
        toast('This browser refused to store the provider — it will work for this session only', 'bad', 4200);
      } else {
        toast(res.persisted ? 'Provider saved on this browser' : 'Provider kept for this session only', 'ok');
      }
      done(true);
    });

    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) done(false); });
    document.addEventListener('keydown', onKey, true);
    
    // Focus input on load
    setTimeout(() => input.focus(), 50);
  });
}

