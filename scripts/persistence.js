'use strict';

// ============================================================
// YOU'S
// ============================================================

const Yous = (() => {
  const STORAGE_KEY = 'yourPosts';
  let itemsCache = null;
  let itemSetCache = null;

  function normalizePostNum(raw) {
    const normalized = String(raw || '').trim();
    return /^\d+$/.test(normalized) ? normalized : null;
  }

  function setCache(items) {
    itemsCache = items;
    itemSetCache = new Set(items);
    return itemsCache;
  }

  function loadAll() {
    if (itemsCache) return itemsCache.slice();

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return setCache([]).slice();

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return setCache([]).slice();

      return setCache(Array.from(new Set(
        parsed
          .map(normalizePostNum)
          .filter(Boolean)
      )).sort((a, b) => Number(a) - Number(b))).slice();
    } catch (e) {
      console.warn('Failed to read local You posts:', e);
      return setCache([]).slice();
    }
  }

  function saveAll(items) {
    setCache(items.slice());

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save local You posts:', e);
    }
  }

  function add(postNum) {
    const normalized = normalizePostNum(postNum);
    if (!normalized) return;

    const items = loadAll();
    if (items.includes(normalized)) return;

    items.push(normalized);
    items.sort((a, b) => Number(a) - Number(b));
    saveAll(items);
  }

  function has(postNum) {
    const normalized = normalizePostNum(postNum);
    if (!normalized) return false;

    if (!itemSetCache) {
      loadAll();
    }

    return itemSetCache.has(normalized);
  }

  function clear() {
    setCache([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  function toFieldValue() {
    return loadAll().join(', ');
  }

  return {
    add,
    has,
    clear,
    toFieldValue,
  };
})();


// ============================================================
// SETTINGS
// ============================================================

const Settings = (() => {
  const STORAGE_KEY = 'boardSettings';
  const STORAGE_VERSION = 1;
  const MAX_CUSTOM_CSS_CHARS = 12000;
  const CUSTOM_CSS_STYLE_ID = 'custom-settings-css';
  const THEME_PRESETS = Object.freeze({
    default: {
      label: 'Default',
      css: `:root {
  --fg: #800000;
  --border: #d9bfb7;
  --link: #34345c;
  --link-hover: #dd0000;
  --table-bg: #ffffee;
  --body-bg: #d4b8b0;
  --post-bg: #f0e0d6;
  --greentext: #789922;
  --post-outline-color: #c9a89e;
  --reply-outline-color: #b8a090;
  --op-name: #ffcc88;
  --op-trip: #ffffaa;
  --op-time: #ddd;
  --op-post-num: #ffaaaa;
  --reply-header-bg: #c8a870;
  --reply-header-fg: #000;
  --reply-name: #800000;
  --reply-trip: #555;
  --reply-time: #444;
  --reply-post-num: #800000;
  --sticky: #ffcc88;
  --thread-mode: #d6f0ff;
  --poster-id-bg: transparent;
  --gh-link: #f0e0d6;
}`,
    },
    blue: {
      label: 'Blue',
      css: `:root {
  --fg: #1f4a7a;
  --border: #b8cade;
  --link: #22548c;
  --link-hover: #b94d31;
  --table-bg: #f7fbff;
  --body-bg: #dfe9f5;
  --post-bg: #edf4fb;
  --greentext: #2d7a45;
  --post-outline-color: #a9bfd7;
  --reply-outline-color: #9db4cc;
  --op-name: #c8e0ff;
  --op-trip: #eef6ff;
  --op-time: #dcecff;
  --op-post-num: #cfe3ff;
  --reply-header-bg: #bfd3e8;
  --reply-header-fg: #17324c;
  --reply-name: #214d78;
  --reply-trip: #355d84;
  --reply-time: #3a5d79;
  --reply-post-num: #274c70;
  --sticky: #f4d38a;
  --thread-mode: #d6eeff;
  --poster-id-bg: rgba(255, 255, 255, 0.55);
  --gh-link: #eef6ff;
}`,
    },
  });
  const DEFAULTS = Object.freeze({
    version: STORAGE_VERSION,
    defaultName: '',
    themePreset: 'default',
    customCss: '',
  });

  let state = loadState();
  let initialized = false;
  let dialogEl = null;
  let inputEl = null;
  let cssEl = null;
  let presetEl = null;
  let yousEl = null;
  let statusEl = null;
  let styleEl = null;
  let lastFocusedEl = null;

  function normalizeName(raw) {
    return Utils.sanitizeText(raw, { maxChars: 20 }).trim();
  }

  function sanitizeState(raw = {}) {
    return {
      version: STORAGE_VERSION,
      defaultName: normalizeName(raw.defaultName || ''),
      themePreset: normalizeThemePreset(raw.themePreset || 'default'),
      customCss: normalizeCustomCss(raw.customCss || ''),
    };
  }

  function normalizeThemePreset(raw) {
    const key = String(raw || '').trim();
    return THEME_PRESETS[key] ? key : 'default';
  }

  function normalizeCustomCss(raw) {
    return String(raw || '')
      .replace(/\r\n?/g, '\n')
      .slice(0, MAX_CUSTOM_CSS_CHARS)
      .trim();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      return sanitizeState(JSON.parse(raw));
    } catch (e) {
      console.warn('Failed to read settings:', e);
      return { ...DEFAULTS };
    }
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  function showStatus(message = '') {
    if (statusEl) statusEl.textContent = message;
  }

  function ensureStyleEl() {
    if (styleEl) return styleEl;

    styleEl = document.getElementById(CUSTOM_CSS_STYLE_ID);
    if (styleEl) return styleEl;

    styleEl = document.createElement('style');
    styleEl.id = CUSTOM_CSS_STYLE_ID;
    document.head.appendChild(styleEl);
    return styleEl;
  }

  function applyThemeCss(nextState) {
    ensureStyleEl().textContent = nextState.customCss || '';
  }

  function loadPresetIntoEditor(presetKey) {
    const normalizedKey = normalizeThemePreset(presetKey);
    const preset = THEME_PRESETS[normalizedKey];
    if (!preset || !cssEl || !presetEl) return;

    presetEl.value = normalizedKey;
    cssEl.value = preset.css;
    showStatus('Loaded. Save to apply.');
  }

  function syncDialog() {
    if (!dialogEl || !inputEl || !cssEl || !presetEl || !yousEl) return;
    inputEl.value = state.defaultName;
    presetEl.value = state.themePreset;
    cssEl.value = state.customCss || THEME_PRESETS[state.themePreset].css;
    yousEl.value = Yous.toFieldValue();
  }

  function applyDefaultName(input, options = {}) {
    if (!input) return;

    const { force = false } = options;
    const wasPrefilled = input.dataset.prefilledBySettings === '1';
    const hasValue = input.value.trim().length > 0;

    if (!state.defaultName) {
      if (force || wasPrefilled) {
        input.value = '';
      }
      delete input.dataset.prefilledBySettings;
      return;
    }

    if (force || !hasValue || wasPrefilled) {
      input.value = state.defaultName;
      input.dataset.prefilledBySettings = '1';
    }
  }

  function bindNameField(target, options = {}) {
    const input = typeof target === 'string' ? document.getElementById(target) : target;
    if (!input) return;

    if (!input.dataset.settingsBound) {
      input.dataset.settingsBound = '1';
      input.addEventListener('input', () => {
        delete input.dataset.prefilledBySettings;
      });
    }

    applyDefaultName(input, options);
  }

  function syncKnownNameFields(options = {}) {
    bindNameField('f-name', options);
    bindNameField('r-name', options);
  }

  function setState(nextState) {
    state = sanitizeState(nextState);
    persistState();
    applyThemeCss(state);
    syncDialog();
    syncKnownNameFields();
  }

  function saveFromDialog() {
    const nextDefaultName = normalizeName(inputEl ? inputEl.value : '');
    const nextThemePreset = normalizeThemePreset(presetEl ? presetEl.value : 'default');
    const nextCustomCss = normalizeCustomCss(cssEl ? cssEl.value : '');
    const changed = nextDefaultName !== state.defaultName
      || nextThemePreset !== state.themePreset
      || nextCustomCss !== state.customCss;

    setState({
      ...state,
      defaultName: nextDefaultName,
      themePreset: nextThemePreset,
      customCss: nextCustomCss,
    });

    showStatus(changed ? 'Saved.' : 'No changes to save.');
  }

  function clearFromDialog() {
    if (inputEl) inputEl.value = '';
    setState({
      ...state,
      defaultName: '',
    });
    showStatus('Name cleared.');
  }

  function resetCssFromDialog() {
    if (cssEl) cssEl.value = '';
    setState({
      ...state,
      themePreset: 'default',
      customCss: '',
    });
    showStatus('CSS reset.');
  }

  function clearYousFromDialog() {
    Yous.clear();
    syncDialog();
    if (document.getElementById('app') && typeof render === 'function') {
      render();
    }
    showStatus('You posts cleared.');
  }

  function closeDialog() {
    if (!dialogEl || dialogEl.hidden) return;

    dialogEl.hidden = true;
    document.body.classList.remove('settings-open');
    showStatus('');

    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      lastFocusedEl.focus();
    }
  }

  function openDialog() {
    ensureDialog();

    lastFocusedEl = document.activeElement;
    syncDialog();
    showStatus('');
    dialogEl.hidden = false;
    document.body.classList.add('settings-open');

    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  }

  function ensureDialog() {
    if (dialogEl) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="settings-modal" id="settings-modal" hidden>
        <div class="settings-backdrop" data-settings-close="1"></div>
        <div class="settings-panel postform-inner" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="postform-header">
            <span id="settings-title">Settings</span>
            <button type="button" class="close-form settings-close-btn" data-settings-close="1">[×]</button>
          </div>
          <div class="settings-panel-body compact-settings-body">
            <div class="form-row settings-form-row">
              <div class="label">Name</div>
              <div class="field-stack">
                <input id="settings-default-name" type="text" placeholder="Anonymous" maxlength="20">
              </div>
            </div>
            <div class="form-row settings-form-row settings-css-row">
              <div class="label">CSS</div>
              <div class="field-stack">
                <textarea id="settings-custom-css" class="settings-css-input" placeholder=":root {
  --fg: #1f4a7a;
  --border: #b8cade;
  --link: #22548c;
  --link-hover: #b94d31;
  --table-bg: #f7fbff;
  --body-bg: #dfe9f5;
  --post-bg: #edf4fb;
  --greentext: #2d7a45;
  --post-outline-color: #a9bfd7;
  --reply-outline-color: #9db4cc;
  --op-name: #c8e0ff;
  --op-trip: #eef6ff;
  --op-time: #dcecff;
  --op-post-num: #cfe3ff;
  --reply-header-bg: #bfd3e8;
  --reply-header-fg: #17324c;
  --reply-name: #214d78;
  --reply-trip: #355d84;
  --reply-time: #3a5d79;
  --reply-post-num: #274c70;
  --sticky: #f4d38a;
  --thread-mode: #d6eeff;
  --poster-id-bg: rgba(255, 255, 255, 0.55);
  --gh-link: #eef6ff;
}

.reply-post .post-header {
  background: var(--reply-header-bg);
  color: var(--reply-header-fg);
}

.reply-post .post-header a,
.reply-post .gh-link {
  color: inherit;
}"></textarea>
                <select id="settings-theme-preset" class="settings-preset-select">
                  ${Object.entries(THEME_PRESETS).map(([key, preset]) =>
                    `<option value="${Utils.escHtml(key)}">${Utils.escHtml(preset.label)}</option>`
                  ).join('')}
                </select>
              </div>
            </div>
            <div class="form-row settings-form-row settings-yous-row">
              <div class="label">(You)'s</div>
              <div class="field-stack">
                <textarea id="settings-yous" class="settings-yous-input" placeholder="No saved posts." readonly></textarea>
                <div class="settings-inline-actions">
                  <button type="button" class="settings-secondary-btn" id="settings-clear-yous-btn">Clear (You)'s</button>
                </div>
              </div>
            </div>
            <div class="settings-status" id="settings-status" aria-live="polite"></div>
          </div>
          <div class="form-row-submit settings-actions">
            <button type="button" class="settings-primary-btn" id="settings-save-btn">Save</button>
          </div>
        </div>
      </div>
    `.trim();

    dialogEl = wrapper.firstElementChild;
    document.body.appendChild(dialogEl);

    inputEl = dialogEl.querySelector('#settings-default-name');
    cssEl = dialogEl.querySelector('#settings-custom-css');
    presetEl = dialogEl.querySelector('#settings-theme-preset');
    yousEl = dialogEl.querySelector('#settings-yous');
    statusEl = dialogEl.querySelector('#settings-status');

    dialogEl.querySelectorAll('[data-settings-close]').forEach(el => {
      el.addEventListener('click', closeDialog);
    });

    dialogEl.querySelector('#settings-save-btn').addEventListener('click', saveFromDialog);
    dialogEl.querySelector('#settings-clear-yous-btn').addEventListener('click', clearYousFromDialog);
    presetEl.addEventListener('change', () => {
      loadPresetIntoEditor(presetEl.value);
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveFromDialog();
      }
    });

    cssEl.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveFromDialog();
      }
    });

    syncDialog();
  }

  function ensureNavButton() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    let actionsEl = nav.querySelector('.nav-actions');
    if (!actionsEl) {
      actionsEl = document.createElement('div');
      actionsEl.className = 'nav-actions';
      nav.appendChild(actionsEl);
    }

    if (actionsEl.querySelector('[data-settings-toggle]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-settings-btn';
    button.dataset.settingsToggle = '1';
    button.textContent = '[Settings]';
    button.addEventListener('click', openDialog);
    actionsEl.appendChild(button);
  }

  function handleGlobalKeydown(e) {
    if (e.key === 'Escape') {
      closeDialog();
    }
  }

  function rememberPostedName(rawName) {
    const nextDefaultName = normalizeName(rawName);
    if (!nextDefaultName) return;
    if (nextDefaultName === state.defaultName) return;

    setState({
      ...state,
      defaultName: nextDefaultName,
    });
  }

  function initUI() {
    applyThemeCss(state);
    ensureNavButton();
    ensureDialog();
    syncKnownNameFields();

    if (initialized) return;
    initialized = true;

    document.addEventListener('keydown', handleGlobalKeydown);
  }

  return {
    initUI,
    openDialog,
    bindNameField,
    rememberPostedName,
    getDefaultName: () => state.defaultName,
  };
})();


// ============================================================
// THREAD IDS
// ============================================================

const ThreadIDs = (() => {
  const STORAGE_KEY = 'threadPosterIds';
  let mapCache = null;

  function loadMap() {
    if (mapCache) return mapCache;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        mapCache = {};
        return mapCache;
      }

      const parsed = JSON.parse(raw);
      mapCache = parsed && typeof parsed === 'object' ? parsed : {};
      return mapCache;
    } catch (e) {
      console.warn('Failed to read thread IDs:', e);
      mapCache = {};
      return mapCache;
    }
  }

  function saveMap(map) {
    mapCache = map;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Failed to save thread IDs:', e);
    }
  }

  function createPosterId() {
    const bytes = new Uint8Array(4);

    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }

    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  function get(threadId) {
    const key = String(threadId || '').trim();
    if (!key) return null;

    const map = loadMap();
    if (map[key]) return map[key];

    const posterId = createPosterId();
    map[key] = posterId;
    saveMap(map);
    return posterId;
  }

  return { get };
})();


// ============================================================
// POORLY MADE ANTISPAM
// ============================================================

const Spam = (() => {
  const KEY = 'lastPost';

  function secondsLeft() {
    const last    = parseInt(localStorage.getItem(KEY) || '0');
    const elapsed = Math.floor((Date.now() - last) / 1000);
    return Math.max(0, CONFIG.cooldown - elapsed);
  }

  function stamp() {
    localStorage.setItem(KEY, Date.now().toString());
  }

  function startCountdown(el, onDone) {
    let secs = secondsLeft();
    if (secs <= 0) { onDone && onDone(); return; }

    el.style.display = 'block';
    el.textContent   = `Wait ${secs}s before posting again.`;

    const iv = setInterval(() => {
      secs--;
      if (secs <= 0) {
        clearInterval(iv);
        el.style.display = 'none';
        onDone && onDone();
      } else {
        el.textContent = `Wait ${secs}s before posting again.`;
      }
    }, 1000);
  }

  return { secondsLeft, stamp, startCountdown };
})();


// ============================================================
// AUTO-REFRESH
// ============================================================

const AutoRefresh = (() => {
  let interval   = null;
  let lastUpdate = null;

  function start(onTick) {
    stop();
    interval = setInterval(() => {
      if (!document.hidden) onTick();
    }, CONFIG.refresh * 1000);
  }

  function stop() {
    if (interval) { clearInterval(interval); interval = null; }
  }

  function setLastUpdate(ts) { lastUpdate = ts; }
  function getLastUpdate()    { return lastUpdate; }

  return { start, stop, setLastUpdate, getLastUpdate };
})();
