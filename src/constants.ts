/** Shared constants for the Tetris game engine. */

/** Board dimensions in cells. */
export const COLS = 10;
export const ROWS = 20;

/** Canvas scaling: each cell is this many CSS pixels. */
export const CELL_SIZE = 30;

/** Canvas dimensions in pixels. */
export const CANVAS_WIDTH = COLS * CELL_SIZE;   // 300
export const CANVAS_HEIGHT = ROWS * CELL_SIZE;  // 600

/** Delay (ms) before a piece locks once it lands. */
export const LOCK_DELAY_MS = 500;

/** Base gravity interval in ms at level 1. Halves every level up to a floor. */
export const BASE_DROP_INTERVAL_MS = 1000;

/** Minimum drop interval regardless of level. */
export const MIN_DROP_INTERVAL_MS = 100;

/** Colors for each tetromino type. */
export const COLORS: Record<string, string> = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000',
  GHOST: 'rgba(255, 255, 255, 0.15)',
};

/** Classic scoring table per lines cleared in a single action. */
export const LINE_SCORES: Record<number, number> = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

/** Lines needed per level increase. */
export const LINES_PER_LEVEL = 10;
