'use strict';

const ViewQuotePreview = (() => {
  function hideQuotePreview() {
    ViewsState.activePreviewLink = null;
    ViewsState.activePreviewToken++;
    const el = ViewCore.ensureQuotePreviewEl();
    el.hidden = true;
    el.innerHTML = '';
  }

  function positionQuotePreview(clientX, clientY) {
    const el = ViewCore.ensureQuotePreviewEl();
    if (el.hidden) return;

    const gap = 16;
    const maxLeft = Math.max(8, window.innerWidth - el.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - el.offsetHeight - 8);
    const left = Math.min(clientX + gap, maxLeft);
    const prefersAbove = clientY + gap + el.offsetHeight > window.innerHeight - 8;
    const top = prefersAbove
      ? Math.max(8, clientY - el.offsetHeight - gap)
      : Math.min(clientY + gap, maxTop);

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function showQuotePreviewContent(html, position = null) {
    const el = ViewCore.ensureQuotePreviewEl();
    el.innerHTML = html;
    el.hidden = false;

    if (position) {
      positionQuotePreview(position.x, position.y);
    } else if (ViewsState.activePreviewLink) {
      const rect = ViewsState.activePreviewLink.getBoundingClientRect();
      positionQuotePreview(rect.right, rect.bottom);
    }
  }

  function renderQuotePreviewPost(post, quoteMap) {
    const { data, isReply, num } = post;
    const meta = Utils.parseMeta(data.body);
    const safeTitle = Utils.sanitizeText(data.title || '');
    const body = Utils.renderPreview(data.body, 500, 8, quoteMap);
    const stickyTag = !isReply && data.isPinned ? '<span class="sticky-tag">[Pinned]</span>' : '';
    const idsTag = !isReply && meta.idsEnabled ? '<span class="thread-mode-tag">[IDs]</span>' : '';
    const isYou = Yous.has(num);
    const headerClass = isReply ? 'post-header reply-post-header' : 'post-header';
    const timeClass = isReply ? 'post-time reply-post-time' : 'post-time';
    const numClass = isReply ? 'post-num reply-post-num' : 'post-num op-post-num';
    const truncatedHtml = body.truncated
      ? '<div class="quote-preview-note">Preview truncated.</div>'
      : '';

    return `
      <div class="quote-preview-card">
        <div class="${isReply ? 'reply-post' : 'op-post'} quote-preview-post">
          <div class="${headerClass}">
            ${!isReply ? `<span class="post-subject">${stickyTag}${idsTag}${Utils.escHtml(safeTitle.slice(0, 50))}</span>` : ''}
            ${Utils.nameHtml(meta, isReply, { isYou })}
            <span class="${timeClass}" title="${Utils.fullTime(data.created_at)}">${Utils.relTime(data.created_at)}</span>
            <span class="${numClass}">No.${num}</span>
          </div>
          <div class="post-body">${body.html || '<em style="color:#aaa">No text.</em>'}</div>
          ${truncatedHtml}
        </div>
      </div>`;
  }

  function getLocalQuotePreview(num) {
    const key = String(num);

    if (ViewsState.currentThreadPostsByNum.has(key)) {
      return {
        post: ViewsState.currentThreadPostsByNum.get(key),
        quoteMap: ViewsState.currentThreadQuoteMap,
      };
    }

    if (ViewsState.currentBoardIssuesByNum.has(key)) {
      return {
        post: {
          data: ViewsState.currentBoardIssuesByNum.get(key),
          isReply: false,
          num: key,
          anchorId: 'op',
          backlinks: [],
        },
        quoteMap: ViewsState.currentBoardQuoteMap,
      };
    }

    return null;
  }

  async function loadQuotePreview(num) {
    return getLocalQuotePreview(num) || QuoteTargets.loadPreview(num);
  }

  async function showQuotePreview(link, position = null) {
    const num = link.dataset.quoteNum;
    if (!num) return;

    ViewsState.activePreviewLink = link;
    const token = ++ViewsState.activePreviewToken;
    showQuotePreviewContent('<div class="quote-preview-loading">Loading...</div>', position);

    const preview = await loadQuotePreview(num);
    if (token !== ViewsState.activePreviewToken || ViewsState.activePreviewLink !== link) return;

    if (!preview) {
      hideQuotePreview();
      return;
    }

    showQuotePreviewContent(renderQuotePreviewPost(preview.post, preview.quoteMap), position);
  }

  function quotePreviewOverHandler(e) {
    const link = e.target.closest('a.quote-link[data-quote-num]');
    if (!link) return;

    if (ViewsState.activePreviewLink === link && !ViewCore.ensureQuotePreviewEl().hidden) {
      positionQuotePreview(e.clientX, e.clientY);
      return;
    }

    showQuotePreview(link, { x: e.clientX, y: e.clientY });
  }

  function quotePreviewMoveHandler(e) {
    if (!ViewsState.activePreviewLink) return;
    if (!e.target.closest('a.quote-link[data-quote-num]')) return;
    positionQuotePreview(e.clientX, e.clientY);
  }

  function quotePreviewOutHandler(e) {
    const link = e.target.closest('a.quote-link[data-quote-num]');
    if (!link || ViewsState.activePreviewLink !== link) return;

    const nextLink = e.relatedTarget && e.relatedTarget.closest
      ? e.relatedTarget.closest('a.quote-link[data-quote-num]')
      : null;

    if (nextLink === link) return;
    hideQuotePreview();
  }

  function quotePreviewFocusHandler(e) {
    const link = e.target.closest('a.quote-link[data-quote-num]');
    if (!link) return;

    const rect = link.getBoundingClientRect();
    showQuotePreview(link, { x: rect.right, y: rect.bottom });
  }

  function quotePreviewBlurHandler(e) {
    const link = e.target.closest('a.quote-link[data-quote-num]');
    if (!link || ViewsState.activePreviewLink !== link) return;
    hideQuotePreview();
  }

  return {
    hideQuotePreview,
    quotePreviewOverHandler,
    quotePreviewMoveHandler,
    quotePreviewOutHandler,
    quotePreviewFocusHandler,
    quotePreviewBlurHandler,
  };
})();
