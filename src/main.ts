/** Entry point: wires renderer, input, and game loop together. */

import { runGame } from './game.js';
import { render, updateUI, UIRefs } from './renderer.js';
import { initInput, Action } from './input.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('Unable to acquire 2D rendering context');
}

// HUD element references
const uiRefs: UIRefs = {
  scoreEl: document.getElementById('score')!,
  linesEl: document.getElementById('lines')!,
  levelEl: document.getElementById('level')!,
  statusEl: document.getElementById('status')!,
};

// Simple action queue so input never blocks the loop
const actionQueue: Action[] = [];

const cleanupInput = initInput((action) => {
  actionQueue.push(action);
});

function getNextAction(): Action | null {
  return actionQueue.shift() ?? null;
}

const stopGame = runGame((state) => {
  render(ctx, state.board, state.activePiece, state.gameOver, state.paused);
  updateUI(uiRefs, state.score, state.lines, state.level);

  if (state.gameOver) {
    uiRefs.statusEl.textContent = 'Game Over — Press R';
  } else if (state.paused) {
    uiRefs.statusEl.textContent = 'Paused';
  } else {
    uiRefs.statusEl.textContent = 'Playing';
  }
}, getNextAction);

// Graceful teardown on page unload
window.addEventListener('beforeunload', () => {
  cleanupInput();
  stopGame();
});
