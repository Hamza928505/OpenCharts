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
 * The key leaves this browser in exactly one place: the `x-api-key` header of
 * the request `analyst.js` makes to Anthropic. It is never in a request body,
 * never in a spec, never in a share link and never in an export.
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
const ENC_PREFIX = 'enc:v1:';
const PASSPHRASE = 'opencharts-ai-config-local';

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

/** Forget it, in memory and on disk. */
export function clearApiKey() {
  sessionApiKey = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* not fatal */ }
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
    main.appendChild(el('h2', 'ask-title', 'AI Analyst — your Anthropic API key'));
    main.appendChild(el('p', 'ask-text',
      'The AI Analyst calls the Anthropic Messages API straight from this page — '
      + 'there is no server in this project to route it through, so the key is yours '
      + 'and the requests are billed to you.'));

    const inputWrap = el('div', 'dlg-col');
    inputWrap.style.marginTop = '16px';
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
    inputWrap.appendChild(input);

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
      clearApiKey();
      input.value = '';
      toast('Key cleared', 'ok');
    });

    saveBtn.addEventListener('click', async () => {
      const key = input.value.trim();
      if (!key) {
        toast('Enter a key, or press Clear Key to remove the one stored', 'bad');
        return;
      }
      
      const res = await setApiKey(key, { persist: checkbox.checked });
      if (!res.ok) {
        toast('This browser refused to store the key — it will work for this session only', 'bad', 4200);
      } else {
        toast(res.persisted ? 'Key saved on this browser' : 'Key kept for this session only', 'ok');
      }
      done(true);
    });

    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) done(false); });
    document.addEventListener('keydown', onKey, true);
    
    // Focus input on load
    setTimeout(() => input.focus(), 50);
  });
}

