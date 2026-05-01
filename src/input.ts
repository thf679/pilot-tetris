/** Keyboard input handling for the Tetris game. */

export type Action = 'moveLeft' | 'moveRight' | 'rotate' | 'softDrop' | 'hardDrop' | 'pause' | 'restart';

/** Map raw keyboard events to game actions. */
const KEY_MAP: Record<string, Action> = {
  ArrowLeft: 'moveLeft',
  ArrowRight: 'moveRight',
  ArrowUp: 'rotate',
  ArrowDown: 'softDrop',
  ' ': 'hardDrop',
  p: 'pause',
  P: 'pause',
  r: 'restart',
  R: 'restart',
};

/**
 * Attach keyboard listeners and invoke the provided callback for each mapped
 * action. Returns a cleanup function.
 */
export function initInput(onAction: (action: Action) => void): () => void {
  const handler = (e: KeyboardEvent) => {
    const action = KEY_MAP[e.key];
    if (!action) return;
    e.preventDefault();
    onAction(action);
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
