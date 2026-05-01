/** Tetromino definitions, spawning and rotation helpers. */

import { Shape, TetrominoType, Piece } from './types.js';
import { COLORS } from './constants.js';

/** Base shape matrices for the seven tetrominoes. */
export const SHAPES: Record<TetrominoType, Shape> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

/** Spawn positions so pieces enter near the top-centre of the board. */
export const SPAWN_X = 3;
export const SPAWN_Y = 0;

/** All tetromino types in an array for random selection. */
const TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/**
 * Return a deep copy of a shape matrix.
 */
function cloneShape(shape: Shape): Shape {
  return shape.map((row) => row.slice());
}

/**
 * Rotate a shape 90 degrees clockwise.
 */
export function rotateShape(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated: Shape = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = shape[r][c];
    }
  }
  return rotated;
}

/**
 * Create a new active piece at the spawn position.
 */
export function spawnPiece(type?: TetrominoType): Piece {
  const t = type ?? TYPES[Math.floor(Math.random() * TYPES.length)];
  return {
    type: t,
    shape: cloneShape(SHAPES[t]),
    x: SPAWN_X,
    y: SPAWN_Y,
    color: COLORS[t],
  };
}

/**
 * Return a new Piece with its shape rotated clockwise.
 */
export function rotatePiece(piece: Piece): Piece {
  return {
    ...piece,
    shape: rotateShape(piece.shape),
  };
}
