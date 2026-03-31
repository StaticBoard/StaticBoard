'use strict';

// ============================================================
// CONFIG
// ============================================================

const CONFIG = {
  github: {
    owner: '',
    repo: '',
    token: '',
  },
  posts: {
    cooldownSeconds: 60,
    maxBodyChars: 2000,
    minBodyChars: 5,
    maxSubjectChars: 50,
    minSubjectChars: 1,
    defaultName: 'Anonymous',
    allowIdsByDefault: false,
  },
  timers: {
    threadRefreshSeconds: 10,
  },
  listing: {
    threadsPerPage: 30,
    previewChars: 300,
    previewLines: 5,
  },
  search: {
    enabled: true,
    includeReplies: true,
    maxQueryChars: 120,
    maxMatchesPerThread: 6,
    maxMatchesPerPost: 2,
    snippetContextChars: 48,
    resultLimit: 100,
    sort: 'relevance',
  },
  labels: {
    log: 'log',
    pinned: 'pinned',
  },
  text: {
    maxCombiningMarks: 3,
  },
  ui: {
    defaultBoard: null,
    // Pick the built-in preset the site should start with outside any
    // board-specific override.
    defaultThemePreset: 'red',
  },
};

// ============================================================
// ============================================================

const BOARD_DEFAULTS = Object.freeze({
  name: '/board/',
  desc: '',
  label: null,
  showInNav: true,
  showInDirectory: true,
  readOnly: false,
  allowThreadCreation: true,
  allowReplyPosting: true,
  allowIds: true,
  defaultIdsEnabled: null,
  forceThreadIds: false,
  searchEnabled: true,
  defaultThemePreset: null,
  forceThemePreset: null,
  threadSubjectPlaceholder: 'Thread subject',
  threadCommentPlaceholder: 'Write something...',
  replyCommentPlaceholder: 'Write something...',
  emptyBoardMessage: 'No threads yet. Start one!',
  readOnlyMessage: 'Posting is disabled on this board.',
  repliesDisabledMessage: 'Replies are disabled on this board.',
  searchPlaceholder: 'Search',
});

// Boards are GitHub issue labels by default.
// Optional board fields:
// - label: override the GitHub label used for this board key
// - showInNav / showInDirectory: hide a board from shared UI lists
// - readOnly: disables both new threads and replies
// - allowThreadCreation / allowReplyPosting: toggle posting flows separately
// - allowIds / defaultIdsEnabled: configure thread IDs per board
// - forceThreadIds: require every new thread on the board to enable IDs
// - searchEnabled: disable board search entirely
// - defaultThemePreset: choose theme preset if user does not override
// - forceThemePreset: always force a preset on this board
// - threadSubjectPlaceholder / threadCommentPlaceholder / replyCommentPlaceholder
// - emptyBoardMessage / readOnlyMessage / repliesDisabledMessage / searchPlaceholder
const BOARDS = {
  plaza: {
    name: '/plaza/',
    desc: 'The place to post.',
    defaultIdsEnabled: true,
    forceThreadIds: false,
    threadSubjectPlaceholder: 'Start a thread',
    threadCommentPlaceholder: 'Post something worth reading. . .',
    replyCommentPlaceholder: 'Reply. . .',
    searchPlaceholder: 'Search /plaza/',
    defaultThemePreset: 'monochrome',
    showInNav: true,
  },
  meta: {
    name: '/meta/',
    desc: 'I am known as the ultimate master!',
    allowIds: false,
    threadSubjectPlaceholder: 'Meta topic',
    threadCommentPlaceholder: 'Talk about the engine, site, or bugs...',
    replyCommentPlaceholder: 'Write a meta reply...',
    searchPlaceholder: 'Search /meta/',
    defaultThemePreset: 'blue',
  },
  test: {
    name: '/test/',
    desc: 'Test.',
    showInDirectory: true,
    threadSubjectPlaceholder: 'Test thread',
    threadCommentPlaceholder: 'Throw junk in here...',
    replyCommentPlaceholder: 'Reply with more junk...',
    forceThreadIds: true,
  },
};


// ============================================================
// ============================================================
// ============================================================

function getBoardKeys() {
  return Object.keys(BOARDS);
}

function normalizeOptionalThemePreset(rawKey, fallbackKey) {
  const normalizedKey = String(rawKey || '').trim();
  return normalizedKey ? getThemePresetKey(normalizedKey, fallbackKey) : null;
}

function getBoardConfig(boardKey) {
  const raw = BOARDS[boardKey];
  if (!raw) return null;

  const forceThreadIds = Boolean(raw.forceThreadIds);
  const siteDefaultPreset = getThemePresetKey(CONFIG.ui.defaultThemePreset);
  const defaultThemePreset = normalizeOptionalThemePreset(raw.defaultThemePreset, siteDefaultPreset);
  const forceThemePreset = normalizeOptionalThemePreset(
    raw.forceThemePreset,
    defaultThemePreset || siteDefaultPreset
  );

  return {
    ...BOARD_DEFAULTS,
    ...raw,
    label: String(raw.label || boardKey).trim() || boardKey,
    allowIds: forceThreadIds ? true : Boolean(raw.allowIds ?? BOARD_DEFAULTS.allowIds),
    defaultIdsEnabled: forceThreadIds
      ? true
      : raw.defaultIdsEnabled == null
        ? BOARD_DEFAULTS.defaultIdsEnabled
        : Boolean(raw.defaultIdsEnabled),
    defaultThemePreset,
    forceThemePreset,
    forceThreadIds,
  };
}

function getBoardThemePolicy(boardKey = null) {
  const board = boardKey ? getBoardConfig(boardKey) : null;
  const siteDefaultPreset = getThemePresetKey(CONFIG.ui.defaultThemePreset);
  const defaultPreset = board && board.defaultThemePreset
    ? board.defaultThemePreset
    : siteDefaultPreset;
  const forcePreset = board && board.forceThemePreset
    ? board.forceThemePreset
    : null;

  return {
    board,
    siteDefaultPreset,
    defaultPreset,
    forcePreset,
    isForced: Boolean(forcePreset),
  };
}

function getBoardLabel(boardKey) {
  const board = getBoardConfig(boardKey);
  return board ? board.label : String(boardKey || '').trim();
}

function getDefaultBoardKey() {
  const configured = String(CONFIG.ui.defaultBoard || '').trim();
  if (configured && BOARDS[configured]) {
    return configured;
  }

  const keys = getBoardKeys();
  return keys.length ? keys[0] : null;
}

// Backwards-compatible aliases for the older flat config shape. The rest of the
// engine still reads these in a few places, so keeping them avoids a noisier
// migration while the nested config is rolled out.
Object.defineProperties(CONFIG, {
  owner: {
    get() { return this.github.owner; },
    set(value) { this.github.owner = String(value || '').trim(); },
  },
  repo: {
    get() { return this.github.repo; },
    set(value) { this.github.repo = String(value || '').trim(); },
  },
  token: {
    get() { return this.github.token; },
    set(value) { this.github.token = String(value || '').trim(); },
  },
  cooldown: {
    get() { return this.posts.cooldownSeconds; },
    set(value) { this.posts.cooldownSeconds = Number(value) || 0; },
  },
  refresh: {
    get() { return this.timers.threadRefreshSeconds; },
    set(value) { this.timers.threadRefreshSeconds = Number(value) || 0; },
  },
  perPage: {
    get() { return this.listing.threadsPerPage; },
    set(value) { this.listing.threadsPerPage = Number(value) || 0; },
  },
  maxBodyChars: {
    get() { return this.posts.maxBodyChars; },
    set(value) { this.posts.maxBodyChars = Number(value) || 0; },
  },
  maxCombiningMarks: {
    get() { return this.text.maxCombiningMarks; },
    set(value) { this.text.maxCombiningMarks = Number(value) || 0; },
  },
  previewChars: {
    get() { return this.listing.previewChars; },
    set(value) { this.listing.previewChars = Number(value) || 0; },
  },
  previewLines: {
    get() { return this.listing.previewLines; },
    set(value) { this.listing.previewLines = Number(value) || 0; },
  },
});
