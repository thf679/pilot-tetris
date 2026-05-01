/** Canvas rendering for the Tetris game. */

import { Board, Piece } from './types.js';
import { COLS, ROWS, CELL_SIZE, COLORS } from './constants.js';

/** Interface for the DOM elements we need to update. */
export interface UIRefs {
  scoreEl: HTMLElement;
  linesEl: HTMLElement;
  levelEl: HTMLElement;
  statusEl: HTMLElement;
}

/**
 * Draw a single cell with the given colour at board coordinates (x, y).
 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
): void {
  const px = x * CELL_SIZE;
  const py = y * CELL_SIZE;

  // Main block
  ctx.fillStyle = color;
  ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

  // Inner highlight (bevel effect)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);

  // Dark edge
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.strokeRect(px, py, CELL_SIZE, CELL_SIZE);
}

/**
 * Render the locked board cells.
 */
function renderBoard(ctx: CanvasRenderingContext2D, board: Board): void {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell) {
        drawCell(ctx, c, r, cell);
      }
    }
  }
}

/**
 * Render a piece (active or ghost) onto the canvas.
 */
function renderPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  offsetY = 0,
  ghost = false
): void {
  const color = ghost ? COLORS.GHOST : piece.color;
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        const x = piece.x + c;
        const y = piece.y + r + offsetY;
        if (y >= 0) {
          drawCell(ctx, x, y, color);
        }
      }
    }
  }
}

/**
 * Compute the number of rows a piece can drop before it collides.
 */
function computeGhostOffset(board: Board, piece: Piece): number {
  let offset = 0;
  while (isValidPosition(board, piece, 0, offset + 1)) {
    offset++;
  }
  return offset;
}

// Re-declare local helper to avoid circular import with board.ts
function isValidPosition(
  board: Board,
  piece: Piece,
  dx = 0,
  dy = 0
): boolean {
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
 * Clear the canvas and redraw the entire game scene.
 */
export function render(
  ctx: CanvasRenderingContext2D,
  board: Board,
  activePiece: Piece | null,
  gameOver: boolean,
  paused: boolean
): void {
  // Clear background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, COLS * CELL_SIZE, ROWS * CELL_SIZE);

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL_SIZE, 0);
    ctx.lineTo(x * CELL_SIZE, ROWS * CELL_SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL_SIZE);
    ctx.lineTo(COLS * CELL_SIZE, y * CELL_SIZE);
    ctx.stroke();
  }

  renderBoard(ctx, board);

  if (activePiece) {
    const ghostOffset = computeGhostOffset(board, activePiece);
    if (ghostOffset > 0) {
      renderPiece(ctx, activePiece, ghostOffset, true);
    }
    renderPiece(ctx, activePiece);
  }

  // Overlay text for paused / game-over states
  ctx.save();
  if (gameOver) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, COLS * CELL_SIZE, ROWS * CELL_SIZE);
    ctx.fillStyle = '#f55';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', (COLS * CELL_SIZE) / 2, (ROWS * CELL_SIZE) / 2 - 12);
    ctx.fillStyle = '#eee';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press R to restart', (COLS * CELL_SIZE) / 2, (ROWS * CELL_SIZE) / 2 + 20);
  } else if (paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, COLS * CELL_SIZE, ROWS * CELL_SIZE);
    ctx.fillStyle = '#eee';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', (COLS * CELL_SIZE) / 2, (ROWS * CELL_SIZE) / 2);
  }
  ctx.restore();
}

/**
 * Update the on-screen HUD values.
 */
export function updateUI(
  refs: UIRefs,
  score: number,
  lines: number,
  level: number
): void {
  refs.scoreEl.textContent = String(score);
  refs.linesEl.textContent = String(lines);
  refs.levelEl.textContent = String(level);
}
