'use strict';

function getBoardKeyForIssue(issue) {
  if (!issue || !Array.isArray(issue.labels)) return null;
  const labelNames = issue.labels
    .map(label => typeof label === 'string' ? label : label && label.name)
    .filter(Boolean);
  return getBoardKeys().find(board => labelNames.includes(getBoardLabel(board))) || null;
}

function getThreadIdFromIssueUrl(url) {
  const match = String(url || '').match(/\/issues\/(\d+)(?:$|[?#])/);
  return match ? match[1] : null;
}

function buildThreadHref(board, threadId, hash = '') {
  const params = new URLSearchParams();
  params.set('board', board);
  params.set('thread', String(threadId));
  return `?${params.toString()}${hash || ''}`;
}

function createThreadQuoteTarget(board, threadId, options = {}) {
  const {
    anchorId = 'op',
    isOp = anchorId === 'op',
    postNum = threadId,
  } = options;
  const hash = anchorId === 'op' ? '' : `#${anchorId}`;

  return {
    href: buildThreadHref(board, threadId, hash),
    board,
    threadId: String(threadId),
    hash,
    anchorId,
    isOp,
    isYou: Yous.has(String(postNum)),
  };
}


// ============================================================
// ROUTER
// ============================================================

const Router = (() => {
  function current() {
    const p = new URLSearchParams(window.location.search);
    return {
      board:  p.get('board')  || null,
      thread: p.get('thread') || null,
      search: p.get('search') || null,
    };
  }

  function go(params) {
    const p = new URLSearchParams();
    if (params.board)  p.set('board',  params.board);
    if (params.thread) p.set('thread', params.thread);
    if (params.search) p.set('search', params.search);
    const hash = params.hash || '';
    history.pushState(params, '', '?' + p.toString() + hash);
    render();
  }

  function toBoard(board, search = null) {
    AutoRefresh.stop();
    go({ board, search });
  }

  function toThread(board, threadId, hash = '') {
    go({ board, thread: threadId, hash });
  }

  window.addEventListener('popstate', () => {
    AutoRefresh.stop();
    render();
  });

  return { current, go, toBoard, toThread };
})();

const QuoteTargets = (() => {
  const targetCache = new Map();
  const issueCache = new Map();
  const replyCache = new Map();
  const previewCache = new Map();

  function getCached(cache, key, loader) {
    const cacheKey = String(key);

    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, loader().catch((error) => {
        cache.delete(cacheKey);
        throw error;
      }));
    }

    return cache.get(cacheKey);
  }

  function getIssue(threadId) {
    return getCached(issueCache, threadId, () => API.getThread(threadId));
  }

  function getReply(replyId) {
    return getCached(replyCache, replyId, () => API.getReply(replyId));
  }

  function createPreviewPost(post, quoteMap = null) {
    return {
      post,
      quoteMap,
    };
  }

  async function resolveExternalTarget(num) {
    try {
      const issue = await getIssue(num);
      const board = getBoardKeyForIssue(issue);
      if (board) {
        return createThreadQuoteTarget(board, issue.number, {
          anchorId: 'op',
          isOp: true,
          postNum: issue.number,
        });
      }
    } catch (e) {
      // Fall through to issue-comment lookup.
    }

    try {
      const reply = await getReply(num);
      const threadId = getThreadIdFromIssueUrl(reply.issue_url);
      if (!threadId) return null;

      const issue = await getIssue(threadId);
      const board = getBoardKeyForIssue(issue);
      if (!board) return null;

      return createThreadQuoteTarget(board, threadId, {
        anchorId: `reply-${reply.id}`,
        isOp: false,
        postNum: reply.id,
      });
    } catch (e) {
      return null;
    }
  }

  function resolve(num, localQuoteMap = null) {
    const key = String(num);

    if (localQuoteMap && localQuoteMap.has(key)) {
      return Promise.resolve(localQuoteMap.get(key));
    }

    if (!targetCache.has(key)) {
      targetCache.set(key, resolveExternalTarget(key));
    }

    return targetCache.get(key);
  }

  async function build(rawBodies, initialQuoteMap = new Map()) {
    const quoteMap = new Map(initialQuoteMap);
    const refs = Array.from(new Set(
      rawBodies
        .flatMap(raw => Utils.extractQuoteRefs(raw))
        .filter(ref => !quoteMap.has(ref))
    ));

    const resolved = await Promise.all(refs.map(async (ref) => {
      const target = await resolve(ref, quoteMap);
      return [ref, target];
    }));

    resolved.forEach(([ref, target]) => {
      if (target) {
        quoteMap.set(ref, target);
      }
    });

    return quoteMap;
  }

  async function loadPreview(num) {
    const key = String(num);

    if (!previewCache.has(key)) {
      previewCache.set(key, (async () => {
        try {
          const issue = await getIssue(key);
          const board = getBoardKeyForIssue(issue);
          if (board) {
            const post = {
              data: issue,
              isReply: false,
              num: String(issue.number),
              anchorId: 'op',
              backlinks: [],
            };
            const quoteMap = await build([issue.body], new Map([
              [String(issue.number), createThreadQuoteTarget(board, issue.number, {
                anchorId: 'op',
                isOp: true,
                postNum: issue.number,
              })],
            ]));
            return createPreviewPost(post, quoteMap);
          }
        } catch (e) {
          // Fall through to issue-comment lookup.
        }

        try {
          const reply = await getReply(key);
          const threadId = getThreadIdFromIssueUrl(reply.issue_url);
          if (!threadId) return null;

          const issue = await getIssue(threadId);
          const board = getBoardKeyForIssue(issue);
          if (!board) return null;

          const post = {
            data: reply,
            isReply: true,
            num: String(reply.id),
            anchorId: `reply-${reply.id}`,
            backlinks: [],
          };
          const quoteMap = await build([reply.body], new Map([
            [String(reply.id), createThreadQuoteTarget(board, threadId, {
              anchorId: `reply-${reply.id}`,
              isOp: false,
              postNum: reply.id,
            })],
          ]));
          return createPreviewPost(post, quoteMap);
        } catch (e) {
          return null;
        }
      })());
    }

    return previewCache.get(key);
  }

  return { build, resolve, loadPreview };
})();


// ============================================================
// NAV
// ============================================================

function buildNav(activeBoard) {
  const navBoards = document.querySelector('.nav-boards');
  if (!navBoards) return;

  const links = getBoardKeys()
    .map((key) => [key, getBoardConfig(key)])
    .filter(([, info]) => info && info.showInNav)
    .map(([key, info]) => {
      const cls = key === activeBoard ? ' class="active"' : '';
      return `<a${cls} href="#" data-nav-board="${Utils.escHtml(key)}">${Utils.escHtml(info.name)}</a>`;
    }).join(' ');

  navBoards.innerHTML = '[ ' + links + ' ]';

  navBoards.querySelectorAll('a[data-nav-board]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      Router.toBoard(a.dataset.navBoard);
    });
  });
}
