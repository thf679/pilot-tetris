/** Browser-side helper that POSTs game-over stats to the local dev server.
 *
 * The dev server (`server.mjs`) reads the gitignored Telegram credentials and
 * forwards the message to the Telegram Bot API, so the bot token is never
 * shipped to the browser.
 *
 * If the request fails (offline, server not running, credentials missing) the
 * error is logged to the console but the game UI is left untouched — the
 * notification is fire-and-forget.
 */

export interface GameOverStats {
  score: number;
  lines: number;
  level: number;
}

const NOTIFY_ENDPOINT = '/api/notify';

export async function notifyGameOver(stats: GameOverStats): Promise<void> {
  try {
    const res = await fetch(NOTIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stats),
    });
    if (!res.ok) {
      console.warn(`[notify] /api/notify returned ${res.status}`);
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (body && typeof body === 'object' && 'ok' in body && !body.ok) {
      console.warn('[notify] Telegram delivery failed:', body);
    }
  } catch (err) {
    console.warn('[notify] notification failed:', err);
  }
}
