'use strict';

// ============================================================
// "API"
// ============================================================

const API = (() => {
  const base = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}`;
  let pinnedIssuesCache = null;
  let pinnedIssuesCacheAt = 0;
  const PINNED_CACHE_TTL = 60 * 1000;
  const jsonCache = new Map();
  const inflightGetRequests = new Map();
  let cacheGeneration = 0;
  const CACHE_TTL = Object.freeze({
    threads: 10 * 1000,
    boardStats: 30 * 1000,
    thread: 10 * 1000,
    replies: 5 * 1000,
    search: 10 * 1000,
    comment: 30 * 1000,
    reply: 30 * 1000,
    logs: 30 * 1000,
  });

  function getIssueLabelNames(issue) {
    if (!issue || !issue.labels) return [];
    return issue.labels.map(label => typeof label === 'string' ? label : label.name).filter(Boolean);
  }

  function issueHasLabel(issue, labelName) {
    const cleanLabel = String(labelName || '').trim();
    return cleanLabel ? getIssueLabelNames(issue).includes(cleanLabel) : false;
  }

  function getIssueState(issue) {
    return String((issue && issue.state) || '').trim().toLowerCase();
  }

  function getIssueStateReason(issue) {
    return String((issue && issue.state_reason) || '').trim().toLowerCase();
  }

  // Completed issues behave like closed threads in the UI, while other closed
  // issues stay hidden from board listings.
  function isCompletedThread(issue) {
    return getIssueState(issue) === 'closed' && getIssueStateReason(issue) === 'completed';
  }

  function isThreadClosed(issue) {
    return getIssueState(issue) === 'closed';
  }

  function isVisibleBoardThread(issue) {
    return getIssueState(issue) === 'open' || isCompletedThread(issue);
  }

  function normalizeIssue(issue) {
    if (!issue) return issue;

    return {
      ...issue,
      state: getIssueState(issue),
      state_reason: getIssueStateReason(issue),
      isClosed: isThreadClosed(issue),
      isCompleted: isCompletedThread(issue),
      bump_at: issue.bump_at || issue.updated_at || issue.created_at || null,
      last_reply_at: issue.last_reply_at || null,
    };
  }

  function getThreadActivityTime(issue) {
    return new Date(issue.bump_at || issue.updated_at || issue.created_at || 0).getTime();
  }

  function sortThreadsByActivity(issues) {
    return issues.slice().sort((a, b) => {
      const timeDiff = getThreadActivityTime(b) - getThreadActivityTime(a);
      if (timeDiff !== 0) return timeDiff;
      return Number(b.number || 0) - Number(a.number || 0);
    });
  }

  async function hydrateThreadActivity(issue) {
    const normalizedIssue = normalizeIssue(issue);

    if (!normalizedIssue || !isVisibleBoardThread(normalizedIssue) || !normalizedIssue.comments) {
      return normalizeIssue({
        ...normalizedIssue,
        bump_at: normalizedIssue.created_at || normalizedIssue.updated_at || null,
        last_reply_at: null,
      });
    }

    try {
      const replies = await API.getReplies(normalizedIssue.number);
      let lastReplyAt = normalizedIssue.created_at || normalizedIssue.updated_at || null;
      let lastBumpAt = normalizedIssue.created_at || normalizedIssue.updated_at || null;

      replies.forEach((reply) => {
        const replyTime = reply && reply.created_at ? reply.created_at : null;
        if (!replyTime) return;

        lastReplyAt = replyTime;

        const meta = Utils.parseMeta(reply.body);
        if (!meta.sage) {
          lastBumpAt = replyTime;
        }
      });

      return normalizeIssue({
        ...normalizedIssue,
        bump_at: lastBumpAt,
        last_reply_at: replies.length ? lastReplyAt : null,
      });
    } catch (e) {
      console.warn('Failed to hydrate thread activity:', normalizedIssue.number, e);
      return normalizeIssue(normalizedIssue);
    }
  }

  async function hydrateThreadsActivity(issues) {
    return Promise.all((issues || []).map(hydrateThreadActivity));
  }

  function getGitHubPinnedIssuesForBoard(pinnedIssues, boardLabel) {
    return pinnedIssues.filter(issue =>
      getIssueState(issue) === 'open' && getIssueLabelNames(issue).includes(boardLabel)
    );
  }

  function mergePinnedIssuesForBoard(issues, pinnedIssues, boardKey) {
    const boardLabel = getBoardLabel(boardKey);
    const visibleIssues = issues.filter(isVisibleBoardThread);
    const labelPinnedIssues = sortThreadsByActivity(visibleIssues
      .filter(issue => issueHasLabel(issue, CONFIG.labels.pinned))
      .map(issue => normalizeIssue({
        ...issue,
        isPinned: true,
      })));
    const labelPinnedNumbers = new Set(labelPinnedIssues.map(issue => issue.number));
    const githubPinnedIssues = sortThreadsByActivity(getGitHubPinnedIssuesForBoard(pinnedIssues, boardLabel)
      .filter(issue => !labelPinnedNumbers.has(issue.number))
      .map(issue => normalizeIssue({
        ...issue,
        isPinned: true,
      })));
    const pinnedNumbers = new Set([
      ...labelPinnedIssues.map(issue => issue.number),
      ...githubPinnedIssues.map(issue => issue.number),
    ]);
    const normalIssues = sortThreadsByActivity(visibleIssues
      .filter(issue => !pinnedNumbers.has(issue.number))
      .map(issue => normalizeIssue({
        ...issue,
        isPinned: false,
      })));

    // Label-based pinning is the engine-level rule. GitHub pinned issues still
    // work, but only as a secondary fallback for threads without the label.
    return [
      ...labelPinnedIssues,
      ...githubPinnedIssues,
      ...normalIssues,
    ];
  }

  function req(path, opts = {}) {
    let url = /^https?:\/\//i.test(path) ? path : base + path;

    return fetch(url, {
      ...opts,
      cache: 'no-cache', 
      headers: {
        'Authorization': `Bearer ${CONFIG.token}`,
        'Accept':        'application/vnd.github+json',
        'Content-Type':  'application/json',
        ...opts.headers,
      },
    });
  }

  function buildGetCacheKey(path, opts = {}) {
    const url = /^https?:\/\//i.test(path) ? path : base + path;
    const headers = new Headers(opts.headers || {});
    return JSON.stringify({
      url,
      accept: headers.get('Accept') || '',
      contentType: headers.get('Content-Type') || '',
    });
  }

  function readCachedJson(cacheKey) {
    const entry = jsonCache.get(cacheKey);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      jsonCache.delete(cacheKey);
      return null;
    }

    return entry.value;
  }

  function writeCachedJson(cacheKey, value, ttlMs) {
    if (ttlMs <= 0) return;

    jsonCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  function clearTransientCaches() {
    cacheGeneration++;
    jsonCache.clear();
    inflightGetRequests.clear();
    pinnedIssuesCache = null;
    pinnedIssuesCacheAt = 0;
  }

  async function getJson(path, errorLabel, opts = {}, cacheTtl = 0, options = {}) {
    const { skipCache = false } = options;
    const useCache = cacheTtl > 0 && !skipCache;
    const cacheKey = useCache ? buildGetCacheKey(path, opts) : null;

    if (useCache) {
      const cached = readCachedJson(cacheKey);
      if (cached) return cached;

      if (inflightGetRequests.has(cacheKey)) {
        // Reuse the same in-flight request so parallel view hydration does not
        // stampede the GitHub API.
        return inflightGetRequests.get(cacheKey);
      }
    }

    const requestPromise = (async () => {
      const res = await req(path, opts);
      if (!res.ok) throw new Error(`${errorLabel}: ${res.status}`);
      return res.json();
    })();
    const requestGeneration = cacheGeneration;

    if (!useCache) {
      return requestPromise;
    }

    inflightGetRequests.set(cacheKey, requestPromise);

    try {
      const data = await requestPromise;
      if (requestGeneration === cacheGeneration) {
        writeCachedJson(cacheKey, data, cacheTtl);
      }
      return data;
    } finally {
      inflightGetRequests.delete(cacheKey);
    }
  }

  async function gql(query, variables = {}) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        'Authorization': `Bearer ${CONFIG.token}`,
        'Accept':        'application/vnd.github+json',
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) throw new Error(`graphql: ${res.status}`);
    const data = await res.json();
    if (data.errors && data.errors.length) {
      throw new Error(`graphql: ${data.errors.map(err => err.message).join('; ')}`);
    }
    return data.data;
  }

  return {
    async getThreads(boardKey, options = {}) {
      const { fresh = false } = options;
      const boardLabel = getBoardLabel(boardKey);
      const [issues, pinnedIssues] = await Promise.all([
        getJson(
          `/issues?state=all&labels=${encodeURIComponent(boardLabel)}&per_page=${CONFIG.perPage}&sort=updated&direction=desc`,
          'getThreads',
          {},
          CACHE_TTL.threads,
          { skipCache: fresh }
        ),
        this.getPinnedIssues().catch((e) => {
          console.warn('Failed to fetch pinned issues:', e);
          return [];
        }),
      ]);

      const [hydratedIssues, hydratedPinnedIssues] = await Promise.all([
        hydrateThreadsActivity(issues),
        hydrateThreadsActivity(pinnedIssues),
      ]);

      return mergePinnedIssuesForBoard(hydratedIssues, hydratedPinnedIssues, boardKey);
    },

    async getAllThreads(boardKey, options = {}) {
      const { fresh = false } = options;
      const boardLabel = getBoardLabel(boardKey);
      const perPage = 100;
      const issues = [];
      let page = 1;

      while (true) {
        const batch = await getJson(
          `/issues?state=all&labels=${encodeURIComponent(boardLabel)}&per_page=${perPage}&page=${page}&sort=updated&direction=desc`,
          'getAllThreads',
          {},
          CACHE_TTL.threads,
          { skipCache: fresh }
        );

        issues.push(...batch);
        if (batch.length < perPage) break;
        page++;
      }

      const pinnedIssues = await this.getPinnedIssues().catch((e) => {
        console.warn('Failed to fetch pinned issues:', e);
        return [];
      });

      const [hydratedIssues, hydratedPinnedIssues] = await Promise.all([
        hydrateThreadsActivity(issues),
        hydrateThreadsActivity(pinnedIssues),
      ]);

      return mergePinnedIssuesForBoard(hydratedIssues, hydratedPinnedIssues, boardKey);
    },

    async getBoardStats(boardKey, options = {}) {
      const { fresh = false } = options;
      const boardLabel = getBoardLabel(boardKey);
      const perPage = 100;
      let page = 1;
      let threadCount = 0;
      let replyCount = 0;

      while (true) {
        const batch = await getJson(
          `/issues?state=all&labels=${encodeURIComponent(boardLabel)}&per_page=${perPage}&page=${page}&sort=updated&direction=desc`,
          'getBoardStats',
          {},
          CACHE_TTL.boardStats,
          { skipCache: fresh }
        );

        // Board stats should match what the engine actually renders, not raw
        // GitHub counts for every issue carrying the label.
        const visibleBatch = batch.filter(isVisibleBoardThread);
        threadCount += visibleBatch.length;
        replyCount += visibleBatch.reduce((sum, issue) => sum + (issue.comments || 0), 0);

        if (batch.length < perPage) break;
        page++;
      }

      return {
        threads: threadCount,
        posts: threadCount + replyCount,
      };
    },

    async getThread(id) {
      const [issue, pinnedIssues] = await Promise.all([
        getJson(`/issues/${id}`, 'getThread', {}, CACHE_TTL.thread),
        this.getPinnedIssues().catch((e) => {
          console.warn('Failed to fetch pinned issues:', e);
          return [];
        }),
      ]);

      const pinnedNumbers = new Set(pinnedIssues.map(item => item.number));
      return {
        ...normalizeIssue(issue),
        isPinned: issueHasLabel(issue, CONFIG.labels.pinned) || pinnedNumbers.has(issue.number),
      };
    },

    async getReplies(id) {
      // GitHub paginates issue comments. Fetching only page 1 means
      // threads with 101+ replies silently stop updating in the UI.
      const perPage = 100;
      const replies = [];
      let page = 1;

      while (true) {
        const batch = await getJson(
          `/issues/${id}/comments?per_page=${perPage}&page=${page}`,
          'getReplies',
          {},
          CACHE_TTL.replies
        );
        replies.push(...batch);

        if (batch.length < perPage) break;
        page++;
      }

      return replies;
    },

    async searchThreads(boardKey, query) {
      const boardLabel = getBoardLabel(boardKey);
      const q = [
        query,
        `repo:${CONFIG.owner}/${CONFIG.repo}`,
        `label:${boardLabel}`,
        'is:issue',
        'state:open',
      ].join(' ');

      const [search, pinnedIssues] = await Promise.all([
        getJson(
          `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=${CONFIG.perPage}`,
          'searchThreads',
          {
            headers: {
              'Accept': 'application/vnd.github.text-match+json',
            },
          },
          CACHE_TTL.search
        ),
        this.getPinnedIssues().catch((e) => {
          console.warn('Failed to fetch pinned issues:', e);
          return [];
        }),
      ]);

      const pinnedNumbers = new Set(pinnedIssues.map(issue => issue.number));
      return {
        ...search,
        items: (search.items || []).map(item => ({
          ...normalizeIssue(item),
          isPinned: issueHasLabel(item, CONFIG.labels.pinned) || pinnedNumbers.has(item.number),
        })),
      };
    },

    async getIssueComment(url) {
      return getJson(url, 'getIssueComment', {}, CACHE_TTL.comment);
    },

    async getReply(id) {
      return getJson(`/issues/comments/${id}`, 'getReply', {}, CACHE_TTL.reply);
    },

    async getLogs(limit = 10, page = 1) {
      const items = await getJson(
        `/issues?state=all&labels=${encodeURIComponent(CONFIG.labels.log)}&per_page=${limit}&page=${page}&sort=created&direction=desc`,
        'getLogs',
        {},
        CACHE_TTL.logs
      );
      return items.filter(item => !item.pull_request);
    },

    async getAllLogs() {
      const perPage = 100;
      const entries = [];
      let page = 1;

      while (true) {
        const batch = await this.getLogs(perPage, page);
        entries.push(...batch);

        if (batch.length < perPage) break;
        page++;
      }

      return entries;
    },

    async getPinnedIssues() {
      const now = Date.now();
      if (pinnedIssuesCache && (now - pinnedIssuesCacheAt) < PINNED_CACHE_TTL) {
        return pinnedIssuesCache;
      }

      const data = await gql(
        `query($owner: String!, $repo: String!, $count: Int!) {
          repository(owner: $owner, name: $repo) {
            pinnedIssues(first: $count) {
              nodes {
                issue {
                  number
                  title
                  body
                  url
                  state
                  isPinned
                  createdAt
                  updatedAt
                  comments {
                    totalCount
                  }
                  labels(first: 20) {
                    nodes {
                      name
                    }
                  }
                }
              }
            }
          }
        }`,
        {
          owner: CONFIG.owner,
          repo: CONFIG.repo,
          count: 3,
        }
      );

      const pinned = (((data || {}).repository || {}).pinnedIssues || {}).nodes || [];
      pinnedIssuesCache = pinned
        .map(node => node && node.issue)
        .filter(issue => issue)
        .map(issue => ({
          number: issue.number,
          title: issue.title,
          body: issue.body,
          html_url: issue.url,
          created_at: issue.createdAt,
          updated_at: issue.updatedAt,
          comments: issue.comments.totalCount,
          labels: (issue.labels.nodes || []).map(label => label.name),
          state: issue.state,
          isPinned: Boolean(issue.isPinned),
        }))
        .map(normalizeIssue);
      pinnedIssuesCacheAt = now;

      return pinnedIssuesCache;
    },

    async createThread(boardKey, title, body) {
      const boardLabel = getBoardLabel(boardKey);
      const res = await req('/issues', {
        method: 'POST',
        body: JSON.stringify({ title, body, labels: [boardLabel] }),
      });
      if (!res.ok) throw new Error(`createThread: ${res.status}`);
      clearTransientCaches();
      return res.json();
    },

    async createReply(threadId, body) {
      const res = await req(`/issues/${threadId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error(`createReply: ${res.status}`);
      clearTransientCaches();
      return res.json();
    },

    isThreadClosed,
    isCompletedThread,
  };
})();

