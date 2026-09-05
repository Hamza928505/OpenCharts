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
    main.appendChild(el('h2', 'ask-title', 'AI Analyst Configuration'));
    main.appendChild(el('p', 'ask-text', 'Enter your LLM API Key (e.g. Gemini, OpenAI) to enable AI data analysis. Your key is used directly from your browser.'));

    const inputWrap = el('div', 'dlg-col');
    inputWrap.style.marginTop = '16px';
    const input = el('input', 'link-input');
    input.type = 'password';
    input.placeholder = 'sk-...';
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

    saveBtn.addEventListener('click', async () => {
      const key = input.value.trim();
      if (!key) {
        toast('Please enter a valid key or click Clear', 'warn');
        return;
      }
      
      sessionApiKey = key;
      if (checkbox.checked) {
        try {
          const encrypted = await encryptForStorage(key);
          localStorage.setItem(STORAGE_KEY, encrypted);
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

