/** Board state management: collision detection, locking, line clearing. */

import { Board, Cell, Piece } from './types.js';
import { COLS, ROWS } from './constants.js';

/**
 * Create a fresh empty board.
 */
export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

/**
 * Check whether a piece in a given position is valid (inside bounds and not
 * overlapping locked cells).
 */
export function isValidPosition(board: Board, piece: Piece, dx = 0, dy = 0): boolean {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        const newX = piece.x + c + dx;
        const newY = piece.y + r + dy;
        if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
        if (newY >= 0 && board[newY][newX] !== null) return false;
      }
    }
  }
  return true;
}

/**
 * Lock a piece into the board by writing its colour into the cell grid.
 */
export function lockPiece(board: Board, piece: Piece): void {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        const y = piece.y + r;
        const x = piece.x + c;
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
          board[y][x] = piece.color;
        }
      }
    }
  }
}

/**
 * Remove fully-filled rows, shift everything above down, and return the number
 * of lines cleared.
 */
export function clearLines(board: Board): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((cell) => cell !== null)) {
      board.splice(r, 1);
      board.unshift(Array<Cell>(COLS).fill(null));
      cleared++;
      r++; // recheck this row index after shift
    }
  }
  return cleared;
}
