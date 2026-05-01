/** Core game engine: state, loop, scoring, and actions. */

import { GameState, Piece, Board } from './types.js';
import {
  BASE_DROP_INTERVAL_MS,
  MIN_DROP_INTERVAL_MS,
  LINES_PER_LEVEL,
  LINE_SCORES,
  LOCK_DELAY_MS,
} from './constants.js';
import { createBoard, isValidPosition, lockPiece, clearLines } from './board.js';
import { spawnPiece, rotatePiece } from './tetromino.js';
import { Action } from './input.js';

/** Called every frame with the current state for rendering. */
export type RenderCallback = (state: GameState) => void;

/**
 * Build a fresh game state.
 */
export function createGameState(): GameState {
  return {
    board: createBoard(),
    activePiece: null,
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    paused: false,
  };
}

/**
 * Compute the drop interval in ms based on the current level.
 */
function dropIntervalForLevel(level: number): number {
  const interval = BASE_DROP_INTERVAL_MS / Math.pow(2, level - 1);
  return Math.max(interval, MIN_DROP_INTERVAL_MS);
}

/**
 * Apply an action to the current game state.
 */
function applyAction(state: GameState, action: Action): void {
  if (state.gameOver) {
    if (action === 'restart') {
      Object.assign(state, createGameState());
      spawnNextPiece(state);
    }
    return;
  }

  if (action === 'pause') {
    state.paused = !state.paused;
    return;
  }

  if (state.paused) return;

  switch (action) {
    case 'moveLeft':
      movePiece(state, -1, 0);
      break;
    case 'moveRight':
      movePiece(state, 1, 0);
      break;
    case 'rotate':
      rotateActivePiece(state);
      break;
    case 'softDrop':
      movePiece(state, 0, 1);
      state.score += 1;
      break;
    case 'hardDrop':
      hardDrop(state);
      break;
    case 'restart':
      Object.assign(state, createGameState());
      spawnNextPiece(state);
      break;
  }
}

/**
 * Attempt to translate the active piece by (dx, dy).
 */
function movePiece(state: GameState, dx: number, dy: number): void {
  if (!state.activePiece) return;
  if (isValidPosition(state.board, state.activePiece, dx, dy)) {
    state.activePiece.x += dx;
    state.activePiece.y += dy;
  }
}

/**
 * Attempt to rotate the active piece clockwise, with simple wall-kick:
 * try shifting left/right/up by one cell if the rotation collides.
 */
function rotateActivePiece(state: GameState): void {
  if (!state.activePiece) return;
  const rotated = rotatePiece(state.activePiece);
  const kicks = [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: -2, dy: 0 },
    { dx: 2, dy: 0 },
  ];
  for (const { dx, dy } of kicks) {
    if (isValidPosition(state.board, { ...rotated, x: rotated.x + dx, y: rotated.y + dy })) {
      state.activePiece.shape = rotated.shape;
      state.activePiece.x += dx;
      state.activePiece.y += dy;
      return;
    }
  }
}

/**
 * Hard-drop the active piece to the lowest valid position and lock it.
 */
function hardDrop(state: GameState): void {
  if (!state.activePiece) return;
  let cellsDropped = 0;
  while (isValidPosition(state.board, state.activePiece, 0, 1)) {
    state.activePiece.y += 1;
    cellsDropped++;
  }
  state.score += cellsDropped * 2;
  lockAndSpawn(state);
}

/**
 * Lock the active piece, clear lines, update score/level, and spawn the next piece.
 */
function lockAndSpawn(state: GameState): void {
  if (!state.activePiece) return;
  lockPiece(state.board, state.activePiece);

  const cleared = clearLines(state.board);
  if (cleared > 0) {
    state.lines += cleared;
    state.score += (LINE_SCORES[cleared] ?? 0) * state.level;
    const newLevel = Math.floor(state.lines / LINES_PER_LEVEL) + 1;
    if (newLevel > state.level) {
      state.level = newLevel;
    }
  }

  spawnNextPiece(state);
}

/**
 * Spawn the next piece and check for game over.
 */
function spawnNextPiece(state: GameState): void {
  const next = spawnPiece();
  if (!isValidPosition(state.board, next)) {
    state.gameOver = true;
    state.activePiece = null;
    return;
  }
  state.activePiece = next;
}

/**
 * Run the game loop.
 *
 * @param onRender  Called each frame with the latest state.
 * @param getAction Returns the next buffered action (or null).
 * @returns         Cleanup function to stop the loop.
 */
export function runGame(
  onRender: RenderCallback,
  getAction: () => Action | null
): () => void {
  const state = createGameState();
  spawnNextPiece(state);

  let lastTime = performance.now();
  let dropAccumulator = 0;
  let lockTimer = 0;
  let locked = false;
  let running = true;

  function loop(now: number) {
    if (!running) return;

    const dt = now - lastTime;
    lastTime = now;

    // Process queued input actions
    let action: Action | null;
    while ((action = getAction())) {
      applyAction(state, action);
    }

    if (!state.paused && !state.gameOver && state.activePiece) {
      const dropInterval = dropIntervalForLevel(state.level);
      dropAccumulator += dt;

      const canDrop = isValidPosition(state.board, state.activePiece, 0, 1);

      if (canDrop) {
        locked = false;
        lockTimer = 0;
        if (dropAccumulator >= dropInterval) {
          const steps = Math.floor(dropAccumulator / dropInterval);
          for (let i = 0; i < steps; i++) {
            if (isValidPosition(state.board, state.activePiece, 0, 1)) {
              state.activePiece.y += 1;
            } else {
              break;
            }
          }
          dropAccumulator %= dropInterval;
        }
      } else {
        // Piece is on the ground — start lock delay
        if (!locked) {
          locked = true;
          lockTimer = 0;
        }
        lockTimer += dt;
        if (lockTimer >= LOCK_DELAY_MS) {
          lockAndSpawn(state);
          dropAccumulator = 0;
          locked = false;
          lockTimer = 0;
        }
      }
    }

    onRender(state);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
  return () => {
    running = false;
  };
}
