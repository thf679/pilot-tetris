// Minimal zero-dependency dev server for pilot-tetris.
//
// - Serves static files from the project root on http://localhost:<PORT>.
// - Exposes POST /api/notify which forwards a JSON body to the Telegram Bot
//   API. The bot token never reaches the browser — the server reads it from
//   the gitignored config/telegram-comms.yaml.
//
// Replaces `npx serve` so the game can fire game-over notifications without
// embedding credentials in client-side code.

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = __dirname;
const PORT = Number(process.env.PORT ?? 3000);
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'telegram-comms.yaml');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.map':  'application/json; charset=utf-8',
};

function readTelegramConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { error: `Config not found at ${CONFIG_PATH}. Copy telegram-comms.yaml.example and fill in credentials.` };
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  // Tiny line-oriented parser: matches `key: "value"` or `key: value`, ignores comments.
  const fields = {};
  for (const line of raw.split(/\r?\n/)) {
    const stripped = line.replace(/#.*$/, '').trim();
    if (!stripped) continue;
    const m = stripped.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fields[m[1]] = value;
  }
  if (!fields.bot_token || !fields.chat_id) {
    return { error: 'bot_token or chat_id missing in telegram-comms.yaml' };
  }
  if (fields.bot_token.startsWith('REPLACE_WITH') || fields.chat_id.startsWith('REPLACE_WITH')) {
    return { error: 'telegram-comms.yaml still has placeholder values — fill in real credentials' };
  }
  return fields;
}

function sendTelegram(text) {
  const cfg = readTelegramConfig();
  if (cfg.error) return Promise.resolve({ ok: false, error: cfg.error });

  const body = JSON.stringify({
    chat_id: cfg.chat_id,
    text,
    parse_mode: 'HTML',
  });
  const opts = {
    method: 'POST',
    hostname: 'api.telegram.org',
    path: `/bot${cfg.bot_token}/sendMessage`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };
  return new Promise((resolve) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.ok ? { ok: true, response: parsed } : { ok: false, error: parsed.description ?? 'unknown error', response: parsed });
        } catch (e) {
          resolve({ ok: false, error: `invalid JSON from Telegram: ${data.slice(0, 200)}` });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(body);
    req.end();
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 64 * 1024) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.normalize(path.join(root, decoded));
  if (!target.startsWith(root)) return null;
  return target;
}

function serveStatic(req, res) {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  let target = safeJoin(PROJECT_ROOT, urlPath);
  if (!target) {
    res.writeHead(400).end('Bad path');
    return;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    res.writeHead(404).end('Not found');
    return;
  }
  // Block access to gitignored secrets even if someone crafts a URL for it.
  const rel = path.relative(PROJECT_ROOT, target);
  if (rel === path.join('config', 'telegram-comms.yaml')) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  const ext = path.extname(target).toLowerCase();
  const type = MIME[ext] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(target).pipe(res);
}

async function handleNotify(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ ok: false, error: 'method not allowed' }));
    return;
  }
  let payload;
  try { payload = await readJsonBody(req); }
  catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ ok: false, error: `invalid JSON: ${e.message}` }));
    return;
  }
  const score = Number(payload.score ?? 0);
  const lines = Number(payload.lines ?? 0);
  const level = Number(payload.level ?? 1);
  const text = [
    '<b>🎮 pilot-tetris — game over</b>',
    `Final score: <b>${score}</b>`,
    `Lines cleared: <b>${lines}</b>`,
    `Level reached: <b>${level}</b>`,
  ].join('\n');

  const result = await sendTelegram(text);
  res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json' })
    .end(JSON.stringify(result));
}

const server = http.createServer(async (req, res) => {
  if (req.url && req.url.split('?')[0] === '/api/notify') {
    await handleNotify(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`pilot-tetris dev server listening on http://localhost:${PORT}`);
  console.log(`POST /api/notify  -> proxied to Telegram (config: ${CONFIG_PATH})`);
});
