'use strict';
// ============================================================
// UTILS
// ============================================================

const Utils = (() => {
  const combiningMarkRe = /\p{M}/u;

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sanitizeText(raw, opts = {}) {
    const {
      maxChars = Infinity,
      preserveNewlines = false,
      maxCombiningMarks = CONFIG.maxCombiningMarks,
    } = opts;

    let text = String(raw || '').replace(/\r\n?/g, '\n');

    try {
      text = text.normalize('NFKC');
    } catch (_) {
      // Leave text as-is if normalization is unavailable.
    }

    text = text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .replace(/[\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '');

    if (!preserveNewlines) {
      text = text.replace(/\n+/g, ' ');
    }

    let cleaned = '';
    let combiningCount = 0;

    for (const ch of text) {
      if (combiningMarkRe.test(ch)) {
        combiningCount++;
        if (combiningCount > maxCombiningMarks) continue;
      } else {
        combiningCount = 0;
      }

      cleaned += ch;
      if (cleaned.length >= maxChars) break;
    }

    return cleaned;
  }

  function relTime(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function fullTime(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  async function parseName(raw) {
    const trimmed = sanitizeText(raw).trim();
    if (!trimmed) return { display: 'Anonymous', trip: null };

    const idx = trimmed.indexOf('#');
    if (idx === -1) return { display: trimmed, trip: null };

    const name = sanitizeText(trimmed.slice(0, idx), { maxChars: 20 }).trim() || 'Anonymous';
    const pass = sanitizeText(trimmed.slice(idx + 1)).trim();
    if (!pass) return { display: name, trip: null };

    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return { display: name, trip: '!' + hex.slice(0, 10) };
  }

  // Posts store board-specific metadata in a footer appended to the body so the
  // GitHub issue/comment body can act as the only source of truth.
  function splitPostMeta(raw) {
    const normalized = String(raw || '').replace(/\r\n?/g, '\n');
    const match = normalized.match(/\n\n---\n([\s\S]*)$/);

    if (!match) {
      return {
        body: normalized,
        fields: null,
      };
    }

    const fields = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;

      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1);
      if (!key) continue;
      fields[key] = value;
    }

    if (!('name' in fields) || !('trip' in fields) || !('sage' in fields)) {
      return {
        body: normalized,
        fields: null,
      };
    }

    return {
      body: normalized.slice(0, match.index),
      fields,
    };
  }

  function normalizePosterId(raw) {
    const cleaned = sanitizeText(raw || '', { maxChars: 12 })
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    return cleaned ? cleaned.slice(0, 8) : null;
  }

  function encodeMeta(body, meta = {}) {
    // Keep the wire format compact and line-based so old posts still parse even
    // if newer metadata fields are added later.
    const lines = [
      `name:${meta.display || 'Anonymous'}`,
      `trip:${meta.trip ?? null}`,
      `sage:${meta.sage ? '1' : '0'}`,
    ];

    if (meta.idsEnabled) {
      lines.push('ids:1');
    }

    const posterId = normalizePosterId(meta.posterId);
    if (posterId) {
      lines.push(`id:${posterId}`);
    }

    return `${body}\n\n---\n${lines.join('\n')}`;
  }

  function parseMeta(raw) {
    const { fields } = splitPostMeta(raw);
    if (!fields) {
      return {
        name: 'Anonymous',
        trip: null,
        sage: false,
        idsEnabled: false,
        posterId: null,
      };
    }

    return {
      name: sanitizeText(fields.name, { maxChars: 20 }).trim() || 'Anonymous',
      trip: fields.trip.trim() === 'null' ? null : sanitizeText(fields.trip).trim(),
      sage: fields.sage.trim() === '1',
      idsEnabled: fields.ids === '1',
      posterId: normalizePosterId(fields.id),
    };
  }

  function cleanBody(raw) {
    return sanitizeText(splitPostMeta(raw).body, { preserveNewlines: true }).trim();
  }

  function extractQuoteRefs(raw) {
    const refs = new Set();
    const text = cleanBody(raw);

    for (const match of text.matchAll(/>>(\d+)/g)) {
      refs.add(match[1]);
    }

    return Array.from(refs);
  }

  function stripMarkdown(raw) {
    return String(raw || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitLogMeta(raw) {
    const text = String(raw || '').replace(/\r\n?/g, '\n').trim();
    const lines = text.split('\n');
    const firstLine = lines[0] ? lines[0].trim() : '';
    const match = firstLine.match(/^desc:\s*(.+)$/i);

    if (!match) {
      return {
        desc: null,
        body: text,
      };
    }

    const body = lines.slice(1).join('\n').trim();
    return {
      desc: match[1].trim() || null,
      body,
    };
  }

  function getLogExcerpt(raw, maxChars = 72) {
    const { desc, body } = splitLogMeta(raw);
    const plain = stripMarkdown(desc || body);
    if (plain.length <= maxChars) return plain;
    return `${plain.slice(0, maxChars).trimEnd()}…`;
  }

  function renderInlineMarkdown(text) {
    let html = escHtml(text);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    return html;
  }

  function renderMarkdownBlock(block) {
    if (!block.trim()) return '';
    if (/^__CODE_BLOCK_\d+__$/.test(block.trim())) return block.trim();

    if (/^#{1,6}\s/.test(block)) {
      const line = block.trim();
      const level = Math.min(6, (line.match(/^#+/) || ['#'])[0].length);
      return `<h${level}>${renderInlineMarkdown(line.slice(level).trim())}</h${level}>`;
    }

    if (/^>\s?/m.test(block) && block.split('\n').every(line => /^>\s?/.test(line.trim()))) {
      const content = block.split('\n')
        .map(line => renderInlineMarkdown(line.replace(/^>\s?/, '').trim()))
        .join('<br>');
      return `<blockquote>${content}</blockquote>`;
    }

    if (block.split('\n').every(line => /^[-*]\s+/.test(line.trim()))) {
      const items = block.split('\n')
        .map(line => `<li>${renderInlineMarkdown(line.replace(/^[-*]\s+/, '').trim())}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    }

    return `<p>${block.split('\n').map(line => renderInlineMarkdown(line.trim())).join('<br>')}</p>`;
  }

  function renderMarkdown(raw) {
    const { body } = splitLogMeta(raw);
    const source = body;
    const fenceRe = /```([\s\S]*?)```/g;
    const codeBlocks = [];
    const tokenized = source.replace(fenceRe, (_, code) => {
      const token = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(`<pre><code>${escHtml(code.trim())}</code></pre>`);
      return token;
    });

    const html = tokenized
      .split(/\n{2,}/)
      .map(block => renderMarkdownBlock(block))
      .filter(Boolean)
      .join('\n');

    return html.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => codeBlocks[Number(index)] || '');
  }

  function renderLine(line, quoteMap) {
    let html = escHtml(line);

    if (quoteMap) {
      html = html.replace(/&gt;&gt;(\d+)/g, (match, num) => {
        const target = quoteMap.get(num);
        if (!target) {
          // Dead quotes stay visible instead of collapsing, which mirrors the
          // "reply to a deleted post" behavior imageboards usually expect.
          return `<span class="dead-quote" data-quote-num="${escHtml(num)}">&gt;&gt;${num}</span>`;
        }

        const markers = [];
        if (target.isOp) {
          markers.push('<span class="quote-marker quote-op-marker">(OP)</span>');
        }
        if (target.isYou) {
          markers.push('<span class="quote-marker quote-you-marker">(You)</span>');
        }
        const attrs = target.href
          ? [
              `href="${escHtml(target.href)}"`,
              target.board ? `data-board="${escHtml(target.board)}"` : '',
              target.threadId ? `data-thread="${escHtml(String(target.threadId))}"` : '',
              target.hash ? `data-hash="${escHtml(target.hash)}"` : '',
            ].filter(Boolean).join(' ')
          : `href="#${escHtml(target.anchorId)}"`;

        return `<a class="quote-link" data-quote-num="${escHtml(num)}" ${attrs}>&gt;&gt;${num}</a>${markers.length ? ` ${markers.join(' ')}` : ''}`;
      });
    }

    return line.startsWith('>')
      ? `<span class="greentext">${html}</span>`
      : html;
  }

  function renderLines(lines, quoteMap = null) {
    return lines.map(line => renderLine(line, quoteMap)).join('<br>');
  }

  // Markdown removed — plain text renderer with greentext support.
  // Lines starting with > become greentext spans; everything else is
  // HTML-escaped and joined with <br>. No external dependencies needed.
  function renderBody(raw, quoteMap = null) {
    const text = cleanBody(raw);
    if (!text) return '';
    return renderLines(text.split('\n'), quoteMap);
  }

  function renderPreview(raw, maxChars = CONFIG.previewChars, maxLines = CONFIG.previewLines, quoteMap = null) {
    const text = cleanBody(raw);
    if (!text) return { html: '', truncated: false };

    const fullLines = text.split('\n');
    const charLimitedText = text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text;
    const previewLines = charLimitedText.split('\n');

    if (previewLines.length > maxLines) {
      const kept = previewLines.slice(0, maxLines);
      const last = kept[maxLines - 1].replace(/…?$/, '').trimEnd();
      kept[maxLines - 1] = `${last}…`;
      return { html: renderLines(kept, quoteMap), truncated: true };
    }

    return {
      html: renderLines(previewLines, quoteMap),
      truncated: text.length > maxChars || fullLines.length > maxLines,
    };
  }

  function nameHtml(meta, isReply, options = {}) {
    const { isYou = false } = options;
    const tripHtml = meta.trip
      ? ` <span class="${isReply ? 'reply-trip' : 'post-trip'}">${escHtml(meta.trip)}</span>`
      : '';
    const sageHtml = meta.sage
      ? ' <span class="sage-tag" title="no-bump">↓</span>'
      : '';
    const youHtml = isYou
      ? ' <span class="you-marker">(You)</span>'
      : '';
    const idHtml = isReply && meta.posterId
      ? ` <span class="poster-id">ID:${escHtml(meta.posterId)}</span>`
      : '';
    const nameClasses = [
      isReply ? 'reply-name' : 'post-name',
      meta.sage ? 'is-sage' : '',
    ].filter(Boolean).join(' ');
    return `<span class="${nameClasses}">${escHtml(meta.name)}${tripHtml}${sageHtml}${youHtml}${idHtml}</span>`;
  }

  return {
    escHtml,
    sanitizeText,
    relTime,
    fullTime,
    parseName,
    encodeMeta,
    parseMeta,
    cleanBody,
    extractQuoteRefs,
    getLogExcerpt,
    renderMarkdown,
    renderBody,
    renderPreview,
    nameHtml,
  };
})();
