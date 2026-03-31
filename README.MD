# StaticBoard

StaticBoard is a static imageboard that uses GitHub Issues as its backend kuz wer R poor I believe.

Case in Point; et cetera dash: no database, no server, no admin panel. Threads are issues, replies are issue comments, boards are labels, pretty simple.

## Why

Small imageboards need the same boring basics:

- boards
- threads
- replies
- quotes, backlinks
- simple hosting

StaticBoard covers those basics in a weird but quasi-practical way:

- Static hosting only*: upload this wherever HTML/CSS/JS is kool to host.
- GitHub-backed content: all posts live in a normal repo.
- Board management by labels: each board is just a label in the repo.
- Sticky support: the main pinning system is label-based now. Give a board thread the `pinned` label and it stays at the top. GitHub-native pinned issues still work as fallback.
- Log page: post an issue with a label instead of fucking with HTML.
- Search: board search is local now, and can search both OPs and replies.
- Local Settings: saved name, `(You)` markers, theme CSS, quote previews, reply backlinks.
- Per-board config: read-only boards, post/reply toggles, ID toggles, forced thread IDs, custom placeholders, nav visibility.
- Board cards: reply count plus how long ago the last reply was.

## What It Does Well

Compared to a basic imageboard setup, this gives you:

- Easier hosting: no database, no app server, no deploy pipeline required. (Although, that's bad, isn't that?)
- Easier backup: your board content already lives in GitHub or wherever.
- Easier manual moderation: GitHub issue tools do a lot of the boring work.
- Easier editing: boards and repo settings live in plain JS, HTML, and CSS files, with per-board behavior in `scripts/config.js`.
- Easier boredom solution: fuck around with this bunch of code instead of wasting time on your life.

## What It Does Not Try To Be

- Not anonymous at the infrastructure level. (Guthib is about feds)
- Not secure against determined abuse. (That's fixable but not really)
- Not a full moderation suite.
- Not a replacement for a real backend if you expect scale.

It is best thought of as a static toy-engine, some fancy way to handle your repository issues, or experimental board base.

## Setup

1. Create a GitHub repo for the board content.
2. Create the labels you want to use as boards.
3. Open [scripts/config.js]
4. Set:
   - `CONFIG.github.owner`
   - `CONFIG.github.repo`
   - `CONFIG.github.token` -- hosting it plainly will let anyone abuse it so think of the way around yourself, I didn't care at the moment.
   - `CONFIG.labels.log`
   - `CONFIG.labels.pinned`
   - `BOARDS`
5. Upload this folder to your static host. (Nekoweb works like a charm)
6. Open the site and tinker shit.

## Board Setup

Boards are defined in `BOARDS` inside `scripts/config.js`.

Example:

```js
const BOARDS = {
  plaza: {
    name: '/plaza/',
    desc: 'General posting.',
    forceThreadIds: true,
    searchPlaceholder: 'Search /plaza/',
  },
  meta:  {
    name: '/meta/',
    desc: 'Site discussion.',
    allowIds: false,
    readOnly: false,
  },
};
```

The key is the board key. By default it also becomes the GitHub label name. If you want a different label, set `label`.

Per-board options:

- `label` (`string`): overrides which GitHub label this board uses.
- `showInNav` (`boolean`): shows or hides the board in the shared top nav.
- `showInDirectory` (`boolean`): shows or hides the board in the homepage board list.
- `readOnly` (`boolean`): disables both new threads and replies.
- `allowThreadCreation` (`boolean`): allows new thread posting on that board.
- `allowReplyPosting` (`boolean`): allows replies in thread view on that board.
- `allowIds` (`boolean`): enables the IDs checkbox for new threads.
- `forceThreadIds` (`boolean`): forces every new thread on that board to use IDs.
- `defaultIdsEnabled` (`boolean`): controls whether the IDs checkbox starts checked.
- `searchEnabled` (`boolean`): enables or disables board search for that board.
- `threadSubjectPlaceholder` (`string`): placeholder text for the new thread subject field.
- `threadCommentPlaceholder` (`string`): placeholder text for the new thread body field.
- `replyCommentPlaceholder` (`string`): placeholder text for the reply body field.
- `emptyBoardMessage` (`string`): message shown when the board has no threads.
- `readOnlyMessage` (`string`): message shown when the board is read-only.
- `repliesDisabledMessage` (`string`): message shown when replies are disabled.
- `searchPlaceholder` (`string`): placeholder text for the board search field.

## Managing The Board

Most management happens directly in GitHub:

- Boards: labels.
- Threads: issues.
- Threads marked as Completed are closed threads.
- Replies: comments on the issues.
- Pin a thread: add the `pinned` label to the issue. GitHub-native pinning still works, but it is secondary now.
- Log entries: issues with `log` label.

## File Layout

- `index.html`: homepage and board directory
- `board.html`: board/thread shell
- `log.html`: site log page
- `board.js`: bootstrap entry
- `scripts/config.js`: site config and board list
- `scripts/api.js`: GitHub API layer
- `scripts/utils.js`: parsing and rendering helpers
- `scripts/persistence.js`: settings, local states, IDs
- `scripts/routing.js`: router, quote target helpers, nav
- `scripts/views.js`: public view entry
- `scripts/views/core.js`: shared view state and helpers
- `scripts/views/quote-preview.js`: quote preview UI
- `scripts/views/board-search.js`: board search logic
- `scripts/views/board-view.js`: board page UI
- `scripts/views/thread-view.js`: thread page UI
- `style.css`: main styling

## Notes

- The posting token currently lives in client-side JS. That is a known compromise of the current approach, you may use Cloudflare workers or something, but what's the point of using this then?
- This project is easiest to recommend for small, low-stakes boards and experiments and best to not recommend at all.
