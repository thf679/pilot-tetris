/** Core type definitions for the Tetris game engine. */

/** A single cell on the board: null for empty, or a string color. */
export type Cell = string | null;

/** The game board as a 2D array of cells. Row-major: board[row][col]. */
export type Board = Cell[][];

/** A tetromino shape as a 2D boolean matrix. */
export type Shape = number[][];

/** One of the seven standard tetromino types. */
export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/** Represents an active (falling) piece. */
export interface Piece {
  type: TetrominoType;
  shape: Shape;
  x: number;
  y: number;
  color: string;
}

/** Current game state snapshot. */
export interface GameState {
  board: Board;
  activePiece: Piece | null;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  paused: boolean;
}
