'use strict';

// Split-file bootstrap. Core modules now live in /scripts/*.js.

async function render() {
  // Only run on board.html — index.html has no #app and should never
  // trigger the router. Without this guard, loading index.html causes
  // render() to fire, find no ?board= param, and call Router.go() which
  // mutates the URL to ?board=plaza and redirects the user away from home.
  const app = document.getElementById('app');
  if (!app) return;

  const { board, thread, search } = Router.current();

  if (thread && board && getBoardConfig(board)) {
    await Views.showThread(board, thread);
  } else if (board && getBoardConfig(board)) {
    await Views.showBoard(board, search || '');
  } else {
    // No valid board in URL — show the first board by default
    const firstBoard = getDefaultBoardKey();
    if (firstBoard) Router.toBoard(firstBoard);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Settings.initUI();
  render();
});
