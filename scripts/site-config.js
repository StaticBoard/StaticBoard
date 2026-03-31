'use strict';

// Host-owned overrides. This file can be generated without touching
// engine internals.

Object.assign(CONFIG.github, {
  owner: "",
  repo: "",
  token: ""
});

Object.assign(CONFIG.labels, {
  log: "log",
  pinned: "pinned"
});

Object.assign(CONFIG.ui, {
  defaultThemePreset: "red"
});

Object.assign(BOARDS, {
  "plaza": {
    name: "/plaza/",
    desc: "The place to post.",
    defaultIdsEnabled: true,
    defaultThemePreset: "monochrome",
    threadSubjectPlaceholder: "Start a thread",
    threadCommentPlaceholder: "Post something worth reading. . .",
    replyCommentPlaceholder: "Reply. . .",
    searchPlaceholder: "Search /plaza/"
  },
  "meta": {
    name: "/meta/",
    desc: "I am known as the ultimate master!",
    allowIds: false,
    defaultThemePreset: "blue",
    threadSubjectPlaceholder: "Meta topic",
    threadCommentPlaceholder: "Talk about the engine, site, or bugs...",
    replyCommentPlaceholder: "Write a meta reply...",
    searchPlaceholder: "Search /meta/"
  },
  "test": {
    name: "/test/",
    desc: "Test.",
    defaultIdsEnabled: true,
    forceThreadIds: true,
    threadSubjectPlaceholder: "Test thread",
    threadCommentPlaceholder: "Throw junk in here...",
    replyCommentPlaceholder: "Reply with more junk..."
  },
});
