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
import { PROVIDERS, detectProvider, resolveProvider, listProviderModels } from './ai-providers.js';

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
  provider: 'auto',
  endpoint: 'http://localhost:11434/v1/chat/completions',
  model: '',
};

function normaliseSettings(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    provider: Object.hasOwn(PROVIDERS, raw.provider) ? raw.provider : 'auto',
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

/** Save automatic key detection or an explicit provider/endpoint override. */
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
    const box = el('div', 'ask ai-config');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'ai-config-title');
    const returnFocus = document.activeElement;
    let loading = null;
    let closed = false;
    let edited = false;
    let lastDetected = null;

    const main = el('div', 'ask-main');
    const title = el('h2', 'ask-title', 'Connect your AI');
    title.id = 'ai-config-title';
    main.appendChild(title);
    main.appendChild(el('p', 'ask-text',
      'Paste your API key. We recognize Gemini, Anthropic, NVIDIA and xAI keys and select a model for you. '
      + 'Requests go directly to that service and use your API quota or billing.'));

    const inputWrap = el('div', 'dlg-col');
    inputWrap.style.marginTop = '16px';
    const input = el('input', 'link-input');
    input.type = 'password';
    input.id = 'ai-config-key';
    input.placeholder = 'Paste your API key';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-describedby', 'ai-config-destination ai-config-error');
    const keyLabel = el('label', 'dlg-label', 'API key');
    keyLabel.htmlFor = input.id;
    const hint = el('p', 'ask-text');
    hint.id = 'ai-config-destination';
    hint.setAttribute('role', 'status');
    const error = el('p', 'analyst-status is-bad');
    error.id = 'ai-config-error';
    error.setAttribute('role', 'alert');
    inputWrap.append(keyLabel, input, hint, error);

    const advanced = el('details', 'ai-config-advanced');
    advanced.appendChild(el('summary', null, 'Advanced — provider, model or local endpoint'));
    const provider = el('select', 'input');
    provider.id = 'ai-config-provider';
    const providerLabel = el('label', 'dlg-label', 'AI provider');
    providerLabel.htmlFor = provider.id;
    Object.entries(PROVIDERS).forEach(([value, entry]) => {
      const option = el('option', null, entry.label);
      option.value = value;
      provider.appendChild(option);
    });
    advanced.append(providerLabel, provider);

    const endpoint = el('input', 'link-input');
    endpoint.type = 'url';
    endpoint.id = 'ai-config-endpoint';
    endpoint.spellcheck = false;
    endpoint.setAttribute('aria-label', 'OpenAI-compatible endpoint');
    endpoint.value = DEFAULT_SETTINGS.endpoint;
    endpoint.placeholder = 'https://your-provider.example/v1';
    const endpointLabel = el('label', 'dlg-label', 'API base URL or chat endpoint');
    endpointLabel.htmlFor = endpoint.id;

    const model = el('input', 'link-input');
    model.type = 'text';
    model.id = 'ai-config-model';
    model.spellcheck = false;
    model.setAttribute('aria-label', 'Model name');
    model.placeholder = 'Automatic (leave blank)';
    model.setAttribute('list', 'ai-config-models');
    const modelLabel = el('label', 'dlg-label', 'Model override (optional)');
    modelLabel.htmlFor = model.id;
    const models = el('datalist');
    models.id = 'ai-config-models';
    const loadBtn = el('button', 'btn', 'Load models');
    loadBtn.type = 'button';
    advanced.append(endpointLabel, endpoint, modelLabel, model, models, loadBtn,
      el('p', 'ask-text', 'Use any chat model supported by this API. Other services need their endpoint; local models can use no key. Browser access (CORS) must be allowed. A trusted local proxy is needed when a service blocks browser requests.'));
    inputWrap.appendChild(advanced);

    const draft = () => ({ provider: provider.value, endpoint: endpoint.value, model: model.value.trim(), key: input.value.trim() });

    const paintProvider = () => {
      const local = provider.value === 'openai';
      endpointLabel.hidden = endpoint.hidden = !local;
      lastDetected = detectProvider(input.value);
      const chosen = provider.value === 'auto' ? lastDetected : provider.value;
      hint.textContent = chosen
        ? `${PROVIDERS[chosen].label} · ${chosen === 'openai' ? endpoint.value : new URL(PROVIDERS[chosen].endpoint).host} · ${model.value.trim() ? 'Custom model' : 'Automatic model'}`
        : input.value.trim() ? 'Unrecognized key format. Choose a service in Advanced; your key has not been sent.'
          : 'Detection happens on your device. Nothing is sent until you chat or load models.';
      loadBtn.disabled = !!loading || !chosen || (!input.value.trim() && !local);
    };
    const changed = () => {
      edited = true;
      loading?.abort();
      loading = null;
      loadBtn.textContent = 'Load models';
      models.replaceChildren();
      error.textContent = '';
      input.removeAttribute('aria-invalid');
      paintProvider();
    };
    provider.addEventListener('change', () => { model.value = ''; changed(); });
    input.addEventListener('input', () => {
      const detected = detectProvider(input.value);
      // A new recognizable key should not inherit the previous service/model.
      // Preserve custom proxy destinations, which may intentionally use that key.
      if (provider.value !== 'openai' && detected && detected !== lastDetected) {
        provider.value = 'auto';
        model.value = '';
      }
      changed();
    });
    endpoint.addEventListener('input', changed);
    model.addEventListener('input', () => { edited = true; paintProvider(); });
    getAiSettings().then((settings) => {
      if (closed || edited) return;
      provider.value = settings.provider;
      endpoint.value = settings.endpoint;
      model.value = settings.model;
      input.value = settings.key || '';
      paintProvider();
    }).catch(paintProvider);
    paintProvider();

    loadBtn.addEventListener('click', async () => {
      const controller = new AbortController();
      loading = controller;
      loadBtn.disabled = true;
      loadBtn.textContent = 'Loading…';
      error.textContent = '';
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const names = await listProviderModels(draft(), controller.signal);
        if (closed || loading !== controller) return;
        models.replaceChildren(...names.map((name) => { const option = el('option'); option.value = name; return option; }));
        hint.textContent = `${names.length} chat models loaded. Leave the model blank for automatic selection, or type to choose.`;
        model.focus();
      } catch (err) {
        if (!closed && loading === controller) error.textContent = controller.signal.aborted ? 'Model lookup timed out. Try again or enter a model manually.' : err.message;
      } finally {
        clearTimeout(timeout);
        if (loading === controller) { loading = null; loadBtn.disabled = false; loadBtn.textContent = 'Load models'; }
      }
    });

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

    box.append(main);
    scrim.appendChild(box);
    document.body.appendChild(scrim);

    const done = (value) => {
      closed = true;
      loading?.abort();
      document.removeEventListener('keydown', onKey, true);
      scrim.remove();
      returnFocus?.focus();
      resolve(value);
    };

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      if (e.key === 'Tab') {
        const focusable = [...box.querySelectorAll('input, select, button, summary')].filter((node) => !node.disabled && node.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    cancelBtn.addEventListener('click', () => done(false));
    clearBtn.addEventListener('click', () => {
      clearAiSettings();
      input.value = '';
      provider.value = 'auto';
      endpoint.value = DEFAULT_SETTINGS.endpoint;
      model.value = '';
      checkbox.checked = false;
      changed();
      toast('AI provider cleared', 'ok');
    });

    saveBtn.addEventListener('click', async () => {
      try { resolveProvider(draft()); } catch (err) {
        error.textContent = err.message;
        if (!input.value.trim() && provider.value !== 'openai') { input.setAttribute('aria-invalid', 'true'); input.focus(); }
        else { advanced.open = true; (provider.value === 'openai' ? endpoint : provider).focus(); }
        return;
      }
      saveBtn.disabled = true;
      const res = await setAiSettings(draft(), { persist: checkbox.checked });
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
    input.focus();
  });
}

