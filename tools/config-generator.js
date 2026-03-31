'use strict';

(function () {
  const THEME_KEYS = getThemePresetKeys();
  const DEFAULT_BOARD_FORM = Object.freeze({
    key: '',
    name: '',
    desc: '',
    label: '',
    showInNav: true,
    showInDirectory: true,
    readOnly: false,
    allowThreadCreation: true,
    allowReplyPosting: true,
    allowIds: true,
    defaultIdsEnabled: null,
    forceThreadIds: false,
    searchEnabled: true,
    defaultThemePreset: '',
    forceThemePreset: '',
    threadSubjectPlaceholder: '',
    threadCommentPlaceholder: '',
    replyCommentPlaceholder: '',
    emptyBoardMessage: '',
    readOnlyMessage: '',
    repliesDisabledMessage: '',
    searchPlaceholder: '',
  });

  const FIELD_ORDER = [
    'name',
    'desc',
    'label',
    'showInNav',
    'showInDirectory',
    'readOnly',
    'allowThreadCreation',
    'allowReplyPosting',
    'allowIds',
    'defaultIdsEnabled',
    'forceThreadIds',
    'searchEnabled',
    'defaultThemePreset',
    'forceThemePreset',
    'threadSubjectPlaceholder',
    'threadCommentPlaceholder',
    'replyCommentPlaceholder',
    'emptyBoardMessage',
    'readOnlyMessage',
    'repliesDisabledMessage',
    'searchPlaceholder',
  ];

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function q(id) {
    return document.getElementById(id);
  }

  function buildThemeOptions(selected = '', options = {}) {
    const { allowBlank = false } = options;
    const blank = allowBlank ? '<option value="">(none)</option>' : '';
    return blank + THEME_KEYS.map((key) => {
      const selectedAttr = key === selected ? ' selected' : '';
      return `<option value="${escapeHtml(key)}"${selectedAttr}>${escapeHtml(getThemePreset(key).label)} (${escapeHtml(key)})</option>`;
    }).join('');
  }

  function buildNullableBooleanOptions(selected = null) {
    const current = selected == null ? '' : String(selected);
    return [
      ['(inherit)', ''],
      ['true', 'true'],
      ['false', 'false'],
    ].map(([label, value]) => {
      const selectedAttr = value === current ? ' selected' : '';
      return `<option value="${value}"${selectedAttr}>${label}</option>`;
    }).join('');
  }

  function normalizeBoardForForm(key, board) {
    const current = board || {};
    return {
      ...DEFAULT_BOARD_FORM,
      key,
      name: current.name || '',
      desc: current.desc || '',
      label: current.label || '',
      showInNav: current.showInNav !== false,
      showInDirectory: current.showInDirectory !== false,
      readOnly: Boolean(current.readOnly),
      allowThreadCreation: current.allowThreadCreation !== false,
      allowReplyPosting: current.allowReplyPosting !== false,
      allowIds: current.allowIds !== false,
      defaultIdsEnabled: current.defaultIdsEnabled == null ? null : Boolean(current.defaultIdsEnabled),
      forceThreadIds: Boolean(current.forceThreadIds),
      searchEnabled: current.searchEnabled !== false,
      defaultThemePreset: current.defaultThemePreset || '',
      forceThemePreset: current.forceThemePreset || '',
      threadSubjectPlaceholder: current.threadSubjectPlaceholder || '',
      threadCommentPlaceholder: current.threadCommentPlaceholder || '',
      replyCommentPlaceholder: current.replyCommentPlaceholder || '',
      emptyBoardMessage: current.emptyBoardMessage || '',
      readOnlyMessage: current.readOnlyMessage || '',
      repliesDisabledMessage: current.repliesDisabledMessage || '',
      searchPlaceholder: current.searchPlaceholder || '',
    };
  }

  function snapshotCurrentConfig() {
    return {
      github: {
        owner: CONFIG.github.owner || '',
        repo: CONFIG.github.repo || '',
        token: CONFIG.github.token || '',
      },
      labels: {
        log: CONFIG.labels.log || '',
        pinned: CONFIG.labels.pinned || '',
      },
      ui: {
        defaultThemePreset: getThemePresetKey(CONFIG.ui.defaultThemePreset),
      },
      boards: getBoardKeys().map((key) => normalizeBoardForForm(key, getBoardConfig(key))),
    };
  }

  function createBoardCard(board = DEFAULT_BOARD_FORM) {
    const article = document.createElement('article');
    article.className = 'board-card';
    article.innerHTML = `
      <div class="board-card-header">
        <div>
          <h3 class="board-card-title">${escapeHtml(board.key ? `/${board.key}/` : 'New Board')}</h3>
          <div class="board-card-meta">${escapeHtml(board.name || 'Unnamed board')}</div>
        </div>
        <button type="button" class="danger-btn" data-remove-board="1">Remove</button>
      </div>
      <table class="board-edit-table">
        <tbody>
          <tr>
            <th>Board Key</th>
            <td><input type="text" data-field="key" value="${escapeHtml(board.key)}" placeholder="plaza"></td>
            <th>Display Name</th>
            <td><input type="text" data-field="name" value="${escapeHtml(board.name)}" placeholder="/plaza/"></td>
          </tr>
          <tr>
            <th>Description</th>
            <td colspan="3"><input type="text" data-field="desc" value="${escapeHtml(board.desc)}" placeholder="The place to post."></td>
          </tr>
          <tr>
            <th>Label</th>
            <td><input type="text" data-field="label" value="${escapeHtml(board.label)}" placeholder="Optional custom label"></td>
            <th>Default IDs</th>
            <td><select data-field="defaultIdsEnabled">${buildNullableBooleanOptions(board.defaultIdsEnabled)}</select></td>
          </tr>
          <tr>
            <th>Theme</th>
            <td class="wide-cell" colspan="3">
              <div class="inline-two">
                <label class="mini-field">
                  <span>Default</span>
                  <select data-field="defaultThemePreset">${buildThemeOptions(board.defaultThemePreset, { allowBlank: true })}</select>
                </label>
                <label class="mini-field">
                  <span>Forced</span>
                  <select data-field="forceThemePreset">${buildThemeOptions(board.forceThemePreset, { allowBlank: true })}</select>
                </label>
              </div>
            </td>
          </tr>
          <tr>
            <th class="section-label">Flags</th>
            <td class="wide-cell" colspan="3">
              <div class="toggle-grid">
                <label><input type="checkbox" data-field="showInNav"${board.showInNav ? ' checked' : ''}> Show In Nav</label>
                <label><input type="checkbox" data-field="showInDirectory"${board.showInDirectory ? ' checked' : ''}> Show In Directory</label>
                <label><input type="checkbox" data-field="readOnly"${board.readOnly ? ' checked' : ''}> Read Only</label>
                <label><input type="checkbox" data-field="allowThreadCreation"${board.allowThreadCreation ? ' checked' : ''}> Allow Threads</label>
                <label><input type="checkbox" data-field="allowReplyPosting"${board.allowReplyPosting ? ' checked' : ''}> Allow Replies</label>
                <label><input type="checkbox" data-field="allowIds"${board.allowIds ? ' checked' : ''}> Allow IDs</label>
                <label><input type="checkbox" data-field="forceThreadIds"${board.forceThreadIds ? ' checked' : ''}> Force Thread IDs</label>
                <label><input type="checkbox" data-field="searchEnabled"${board.searchEnabled ? ' checked' : ''}> Search Enabled</label>
              </div>
            </td>
          </tr>
          <tr>
            <th class="section-label">Placeholders</th>
            <td class="wide-cell" colspan="3">
              <div class="stack-inputs">
                <div class="mini-grid">
                  <label class="mini-field">
                    <span>Thread Subject</span>
                    <input type="text" data-field="threadSubjectPlaceholder" value="${escapeHtml(board.threadSubjectPlaceholder)}" placeholder="Thread subject">
                  </label>
                  <label class="mini-field">
                    <span>Thread Comment</span>
                    <input type="text" data-field="threadCommentPlaceholder" value="${escapeHtml(board.threadCommentPlaceholder)}" placeholder="Thread comment">
                  </label>
                  <label class="mini-field">
                    <span>Reply Comment</span>
                    <input type="text" data-field="replyCommentPlaceholder" value="${escapeHtml(board.replyCommentPlaceholder)}" placeholder="Reply comment">
                  </label>
                  <label class="mini-field">
                    <span>Search</span>
                    <input type="text" data-field="searchPlaceholder" value="${escapeHtml(board.searchPlaceholder)}" placeholder="Search">
                  </label>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <th class="section-label">Messages</th>
            <td class="wide-cell" colspan="3">
              <div class="stack-inputs">
                <div class="mini-grid">
                  <label class="mini-field full">
                    <span>Empty Board</span>
                    <input type="text" data-field="emptyBoardMessage" value="${escapeHtml(board.emptyBoardMessage)}" placeholder="Empty board message">
                  </label>
                  <label class="mini-field">
                    <span>Read Only</span>
                    <input type="text" data-field="readOnlyMessage" value="${escapeHtml(board.readOnlyMessage)}" placeholder="Read only message">
                  </label>
                  <label class="mini-field">
                    <span>Replies Disabled</span>
                    <input type="text" data-field="repliesDisabledMessage" value="${escapeHtml(board.repliesDisabledMessage)}" placeholder="Replies disabled message">
                  </label>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `.trim();

    article.querySelectorAll('input, select').forEach((field) => {
      field.addEventListener('input', updateOutput);
      field.addEventListener('change', updateOutput);
    });

    const keyInput = article.querySelector('[data-field="key"]');
    const nameInput = article.querySelector('[data-field="name"]');
    const titleEl = article.querySelector('.board-card-title');
    const metaEl = article.querySelector('.board-card-meta');
    const syncCardHeading = () => {
      if (titleEl) {
        const key = keyInput ? keyInput.value.trim() : '';
        titleEl.textContent = key ? `/${key}/` : 'New Board';
      }
      if (metaEl) {
        const name = nameInput ? nameInput.value.trim() : '';
        metaEl.textContent = name || 'Unnamed board';
      }
    };
    if (keyInput) {
      keyInput.addEventListener('input', syncCardHeading);
    }
    if (nameInput) {
      nameInput.addEventListener('input', syncCardHeading);
    }

    article.querySelector('[data-remove-board]').addEventListener('click', () => {
      article.remove();
      updateOutput();
    });

    return article;
  }

  function collectBoard(card) {
    function text(field) {
      return card.querySelector(`[data-field="${field}"]`).value.trim();
    }

    function bool(field) {
      return card.querySelector(`[data-field="${field}"]`).checked;
    }

    function nullableBool(field) {
      const value = card.querySelector(`[data-field="${field}"]`).value;
      if (value === '') return null;
      return value === 'true';
    }

    return {
      key: text('key'),
      name: text('name'),
      desc: text('desc'),
      label: text('label'),
      showInNav: bool('showInNav'),
      showInDirectory: bool('showInDirectory'),
      readOnly: bool('readOnly'),
      allowThreadCreation: bool('allowThreadCreation'),
      allowReplyPosting: bool('allowReplyPosting'),
      allowIds: bool('allowIds'),
      defaultIdsEnabled: nullableBool('defaultIdsEnabled'),
      forceThreadIds: bool('forceThreadIds'),
      searchEnabled: bool('searchEnabled'),
      defaultThemePreset: text('defaultThemePreset'),
      forceThemePreset: text('forceThemePreset'),
      threadSubjectPlaceholder: text('threadSubjectPlaceholder'),
      threadCommentPlaceholder: text('threadCommentPlaceholder'),
      replyCommentPlaceholder: text('replyCommentPlaceholder'),
      emptyBoardMessage: text('emptyBoardMessage'),
      readOnlyMessage: text('readOnlyMessage'),
      repliesDisabledMessage: text('repliesDisabledMessage'),
      searchPlaceholder: text('searchPlaceholder'),
    };
  }

  function collectState() {
    return {
      github: {
        owner: q('github-owner').value.trim(),
        repo: q('github-repo').value.trim(),
        token: q('github-token').value.trim(),
      },
      labels: {
        log: q('label-log').value.trim(),
        pinned: q('label-pinned').value.trim(),
      },
      ui: {
        defaultThemePreset: q('site-default-theme').value.trim() || DEFAULT_THEME_PRESET_KEY,
      },
      boards: Array.from(document.querySelectorAll('.board-card')).map(collectBoard),
    };
  }

  function jsValue(value) {
    return JSON.stringify(value);
  }

  function emitObjectEntries(entries, indentLevel = 0) {
    const indent = '  '.repeat(indentLevel);
    return entries.map(([key, value]) => `${indent}${key}: ${value}`).join(',\n');
  }

  function buildBoardConfigLiteral(board) {
    const lines = [];
    const defaults = BOARD_DEFAULTS;

    if (board.name) lines.push(['name', jsValue(board.name)]);
    if (board.desc) lines.push(['desc', jsValue(board.desc)]);
    if (board.label && board.label !== board.key) lines.push(['label', jsValue(board.label)]);
    if (board.showInNav !== defaults.showInNav) lines.push(['showInNav', jsValue(board.showInNav)]);
    if (board.showInDirectory !== defaults.showInDirectory) lines.push(['showInDirectory', jsValue(board.showInDirectory)]);
    if (board.readOnly !== defaults.readOnly) lines.push(['readOnly', jsValue(board.readOnly)]);
    if (board.allowThreadCreation !== defaults.allowThreadCreation) lines.push(['allowThreadCreation', jsValue(board.allowThreadCreation)]);
    if (board.allowReplyPosting !== defaults.allowReplyPosting) lines.push(['allowReplyPosting', jsValue(board.allowReplyPosting)]);
    if (board.allowIds !== defaults.allowIds) lines.push(['allowIds', jsValue(board.allowIds)]);
    if (board.defaultIdsEnabled !== defaults.defaultIdsEnabled) lines.push(['defaultIdsEnabled', jsValue(board.defaultIdsEnabled)]);
    if (board.forceThreadIds !== defaults.forceThreadIds) lines.push(['forceThreadIds', jsValue(board.forceThreadIds)]);
    if (board.searchEnabled !== defaults.searchEnabled) lines.push(['searchEnabled', jsValue(board.searchEnabled)]);
    if (board.defaultThemePreset) lines.push(['defaultThemePreset', jsValue(board.defaultThemePreset)]);
    if (board.forceThemePreset) lines.push(['forceThemePreset', jsValue(board.forceThemePreset)]);
    if (board.threadSubjectPlaceholder && board.threadSubjectPlaceholder !== defaults.threadSubjectPlaceholder) lines.push(['threadSubjectPlaceholder', jsValue(board.threadSubjectPlaceholder)]);
    if (board.threadCommentPlaceholder && board.threadCommentPlaceholder !== defaults.threadCommentPlaceholder) lines.push(['threadCommentPlaceholder', jsValue(board.threadCommentPlaceholder)]);
    if (board.replyCommentPlaceholder && board.replyCommentPlaceholder !== defaults.replyCommentPlaceholder) lines.push(['replyCommentPlaceholder', jsValue(board.replyCommentPlaceholder)]);
    if (board.emptyBoardMessage && board.emptyBoardMessage !== defaults.emptyBoardMessage) lines.push(['emptyBoardMessage', jsValue(board.emptyBoardMessage)]);
    if (board.readOnlyMessage && board.readOnlyMessage !== defaults.readOnlyMessage) lines.push(['readOnlyMessage', jsValue(board.readOnlyMessage)]);
    if (board.repliesDisabledMessage && board.repliesDisabledMessage !== defaults.repliesDisabledMessage) lines.push(['repliesDisabledMessage', jsValue(board.repliesDisabledMessage)]);
    if (board.searchPlaceholder && board.searchPlaceholder !== defaults.searchPlaceholder) lines.push(['searchPlaceholder', jsValue(board.searchPlaceholder)]);

    if (!lines.length) {
      lines.push(['name', jsValue(board.key ? `/${board.key}/` : '')]);
    }

    return `  ${jsValue(board.key)}: {\n${emitObjectEntries(lines, 2)}\n  }`;
  }

  function buildSiteConfig(state) {
    const boardBlocks = state.boards.map(buildBoardConfigLiteral);
    return [
      "'use strict';",
      '',
      '// Host-owned overrides. This file can be generated without touching',
      '// engine internals.',
      '',
      'Object.assign(CONFIG.github, {',
      emitObjectEntries([
        ['owner', jsValue(state.github.owner)],
        ['repo', jsValue(state.github.repo)],
        ['token', jsValue(state.github.token)],
      ], 1),
      '});',
      '',
      'Object.assign(CONFIG.labels, {',
      emitObjectEntries([
        ['log', jsValue(state.labels.log)],
        ['pinned', jsValue(state.labels.pinned)],
      ], 1),
      '});',
      '',
      'Object.assign(CONFIG.ui, {',
      emitObjectEntries([
        ['defaultThemePreset', jsValue(state.ui.defaultThemePreset)],
      ], 1),
      '});',
      '',
      'Object.assign(BOARDS, {',
      boardBlocks.join(',\n'),
      '});',
      '',
    ].join('\n');
  }

  function validateState(state) {
    const errors = [];
    const keys = state.boards.map((board) => board.key).filter(Boolean);
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);

    if (!state.labels.log) errors.push('Log label is required.');
    if (!state.labels.pinned) errors.push('Pinned label is required.');
    if (!state.ui.defaultThemePreset) errors.push('Site default theme is required.');
    if (!state.boards.length) errors.push('Add at least one board.');
    if (duplicates.length) errors.push(`Duplicate board keys: ${Array.from(new Set(duplicates)).join(', ')}`);
    state.boards.forEach((board, index) => {
      if (!board.key) errors.push(`Board ${index + 1} is missing a key.`);
      if (!board.name) errors.push(`Board ${board.key || index + 1} is missing a display name.`);
    });

    return errors;
  }

  function setStatus(message, isError = false) {
    const statusEl = q('generator-status');
    statusEl.textContent = message;
    statusEl.className = isError ? 'status error' : 'status';
  }

  function updateOutput() {
    const state = collectState();
    const errors = validateState(state);
    const outputEl = q('output');

    if (errors.length) {
      outputEl.value = buildSiteConfig(state);
      setStatus(errors.join(' '), true);
      return;
    }

    outputEl.value = buildSiteConfig(state);
    setStatus('Ready to copy or download.');
  }

  function fillFormFromState(state) {
    q('github-owner').value = state.github.owner;
    q('github-repo').value = state.github.repo;
    q('github-token').value = state.github.token;
    q('label-log').value = state.labels.log;
    q('label-pinned').value = state.labels.pinned;
    q('site-default-theme').innerHTML = buildThemeOptions(state.ui.defaultThemePreset);
    q('site-default-theme').value = state.ui.defaultThemePreset;

    const list = q('boards-list');
    list.innerHTML = '';
    state.boards.forEach((board) => {
      list.appendChild(createBoardCard(board));
    });
  }

  function bindTopLevelInputs() {
    document.querySelectorAll('input, select').forEach((field) => {
      field.addEventListener('input', updateOutput);
      field.addEventListener('change', updateOutput);
    });
  }

  function addBoard() {
    const list = q('boards-list');
    const nextIndex = list.children.length + 1;
    const defaultBoard = normalizeBoardForForm('', {
      name: `/board${nextIndex}/`,
      desc: '',
      showInNav: true,
      showInDirectory: true,
      allowThreadCreation: true,
      allowReplyPosting: true,
      allowIds: true,
      searchEnabled: true,
    });
    list.appendChild(createBoardCard(defaultBoard));
    updateOutput();
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(q('output').value);
      setStatus('Copied site-config.js to clipboard.');
    } catch (e) {
      setStatus('Copy failed. You can still copy from the output box.', true);
    }
  }

  function downloadOutput() {
    const blob = new Blob([q('output').value], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'site-config.js';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Downloaded site-config.js.');
  }

  function init() {
    q('site-default-theme').innerHTML = buildThemeOptions(getThemePresetKey(CONFIG.ui.defaultThemePreset));
    fillFormFromState(snapshotCurrentConfig());
    bindTopLevelInputs();

    q('add-board-btn').addEventListener('click', addBoard);
    q('reload-current-btn').addEventListener('click', () => {
      fillFormFromState(snapshotCurrentConfig());
      updateOutput();
    });
    q('copy-output-btn').addEventListener('click', copyOutput);
    q('download-output-btn').addEventListener('click', downloadOutput);

    updateOutput();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
