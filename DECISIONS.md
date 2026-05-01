# DECISIONS

This document captures the key architectural decisions, tools, and trade-offs made
while building **pilot-tetris**. It is intended for future maintainers and anyone
evaluating the project as an example of a composite toolkit-framework consumer.

---

## 1. Game architecture

### 1.1 Vanilla TypeScript (no framework)

**Decision:** Implement the game as plain TypeScript modules served straight to
the browser, with no UI framework (React, Vue, Svelte, etc.).

**Rationale:**
- The game has only one screen and a small DOM HUD — a framework would be pure
  overhead.
- The hot path is a `requestAnimationFrame` loop that mutates a shared
  `GameState` object. A reactive framework would either fight that pattern or
  re-render every frame anyway.
- No framework keeps the dependency tree to a single dev-dependency
  (`typescript`), which is much easier to audit.

**Trade-off:** No component reuse / declarative UI ergonomics. Acceptable
because the UI surface is fixed.

### 1.2 Canvas 2D for the playfield, DOM for the HUD

**Decision:** The 10×20 playing field is rendered to an HTML `<canvas>` via the
2D context. The HUD (score, lines, level, status, controls) lives in regular
HTML/CSS panels next to the canvas.

**Rationale:**
- Canvas gives sub-pixel control and consistent frame timing for the falling
  pieces and ghost overlay.
- The HUD changes only on score/line events, so DOM updates via `textContent`
  are cheap and avoid redrawing it every frame.
- Keeping the two layers separate means CSS can style the HUD without leaking
  into the rendering loop.

**Trade-off:** Two rendering surfaces to keep in sync. Bridged by a small
`UIRefs` interface in `renderer.ts`.

### 1.3 ES modules native, no bundler

**Decision:** TypeScript compiles to ES modules in `dist/`, which `index.html`
loads directly via `<script type="module">`. No Vite, Webpack, esbuild, or
Rollup.

**Rationale:**
- All evergreen browsers (and the Chrome target this project requires) support
  native ES modules.
- A bundler would add config surface and a watcher process for no real benefit
  here — every file is small, there is no tree-shaking opportunity worth the
  cost, and the dev loop is already `tsc --watch` + a static file server.

**Trade-off:** No code splitting or minification. Both are unnecessary at this
size; the entire compiled output is well under 50 KB.

### 1.4 Strict TypeScript

**Decision:** `tsconfig.json` sets `"strict": true` and emits declaration files
plus source maps.

**Rationale:**
- The game state has a fairly rich type graph (Board / Piece / Shape / Action)
  and a one-letter typo in a piece type would silently break rotation. Strict
  mode catches these at compile time.
- Source maps and declaration files make the compiled output debuggable in
  Chrome DevTools and consumable as a library if anyone ever wants to embed it.

### 1.5 Single mutable `GameState` + action queue

**Decision:** The game keeps one `GameState` object that the loop mutates in
place. Input handlers push `Action` values onto a queue; the loop drains it at
the top of each frame.

**Rationale:**
- Decouples input timing from frame timing — fast key presses never get lost
  even if a frame is busy.
- Mutable state is the simplest model that fits a 60 FPS loop. An immutable
  approach would allocate a new state object every frame for no observable
  benefit.

**Trade-off:** Easier to introduce bugs by mutating state from the wrong place.
Mitigated by keeping all mutation inside `game.ts` and treating `renderer.ts`
as read-only.

### 1.6 Lock delay + simple wall kicks

**Decision:** A piece that touches the floor waits 500 ms before locking, and
rotation tries six fallback offsets (`{0,0}`, `{±1,0}`, `{0,-1}`, `{±2,0}`)
before giving up.

**Rationale:**
- Lock delay matches the modern Tetris guideline and lets players slide pieces
  along the floor for late saves.
- Six-offset wall kicks cover the common cases (T/S/Z near walls and I-piece
  near floor) without implementing the full SRS kick table, which is overkill
  for a pilot project.

**Trade-off:** Not a 100 % SRS-compliant rotation system. Sufficient for
casual play; a competitive port would need the full kick tables.

---

## 2. Toolkit-framework integration

### 2.1 Composite consumer of two tools

**Decision:** Pilot-tetris is a *composite project* in the toolkit-framework
sense. It consumes two repos as tools:

| Tool | Repo | Role |
|---|---|---|
| `tool-project-qa` | `github.com/thf679/tool-project-qa` | Indexes `src/` + `README.md` to answer questions about the codebase. |
| `tool-telegram-comms` | `github.com/thf679/tool-telegram-comms` | Sends Telegram messages over the Bot API. |

**Rationale:**
- The whole point of this pilot is to exercise the toolkit-framework
  consumer-side flow: declare tools in `tools.lock`, configure each in
  `config/<tool>.yaml`, and let the framework wire them together at bootstrap.
- Picking a Q&A tool plus a comms tool means we can demonstrate the
  *contract-driven* part of the framework — `tool-project-qa` consumes the
  `telegram-send` contract that `tool-telegram-comms` provides, so a question
  also produces a notification.

### 2.2 `tools.lock` over `package.json`-style ranges

**Decision:** Pin tool versions to exact tags in `tools.lock`
(`v0.1.0` for both today).

**Rationale:**
- The framework is young; range-based resolution would create silent breakage
  whenever a tool publishes a new tag.
- Lockfile-only resolution keeps `bootstrap.py` deterministic across machines.

**Trade-off:** Updates require an explicit bump. That is the desired behaviour
for a pilot.

### 2.3 Tool configs live under `config/`, never under `tools/`

**Decision:** Each tool gets its own `config/<tool>.yaml` in the composite
project. The cloned tool sources go under `tools/<tool>/` and are treated as
read-only.

**Rationale:**
- Keeps consumer-owned settings (paths to index, API tokens) cleanly separated
  from vendor-owned source.
- Makes it safe to wipe `tools/` and re-run bootstrap — no local data is lost.

### 2.4 Secrets are local-only

**Decision:** `config/telegram-comms.yaml` is gitignored. The repo ships a
`config/telegram-comms.yaml.example` with placeholders that contributors copy
and fill in.

**Rationale:**
- The Telegram Bot API token is a secret; committing it to a public repo
  exposes the bot to abuse.
- Mirrors the well-known `.env` / `.env.example` convention so it requires no
  explanation.

**Trade-off:** Anyone cloning has to do one extra step before notifications
work. The README documents it; the game itself runs without this step.

### 2.5 Game runs without the Python tools

**Decision:** The browser game in `index.html` + `dist/` works on its own. The
toolkit tools only run when explicitly invoked via Python.

**Rationale:**
- Keeps the "clone and play in Chrome" path fast and dependency-light: install
  Node, `npm install`, build, serve.
- Tool integration is opt-in for contributors who also want Q&A or
  notification flows.

### 2.6 Game-over Telegram notification via a tiny Node proxy

**Decision:** When the game state transitions to `gameOver`, the browser POSTs
`{ score, lines, level }` to `/api/notify` on the local dev server
(`server.mjs`). The Node server reads the gitignored
`config/telegram-comms.yaml`, formats the message, and forwards it to the
Telegram Bot API. The bot token never reaches the browser.

**Rationale:**
- A direct `fetch` from the browser to `api.telegram.org` would require either
  embedding the bot token in the page (it would then be visible in DevTools or
  any saved page) or fetching the gitignored YAML over HTTP — both leak the
  token to anyone who can reach the dev server.
- A small Node server keeps the secret on the same trust boundary as the file
  itself: only processes that can read the file can use the credentials.
- Pure Node + built-ins (`http`, `https`, `fs`) means no new dependencies — the
  dev tree stays at one dev-dep (TypeScript).
- The endpoint is deliberately narrow: the client only sends the three score
  fields; the server controls the message format. There is no way for the
  browser to inject arbitrary Telegram payloads.

**Implementation notes:**
- `src/notify.ts` is a tiny browser-side helper; it fire-and-forgets the
  request so a missing or unreachable server never crashes the game loop.
- `src/main.ts` tracks a `notifiedThisRound` flag so the message fires exactly
  once per game and re-arms when the player presses **R** to restart.
- `server.mjs` explicitly returns 403 for `config/telegram-comms.yaml` so the
  secrets file cannot be retrieved over HTTP even though it lives under the
  served root.
- `scripts/notify.sh` wraps the same Telegram call as a CLI for ad-hoc
  notifications (deploy hooks, manual pings) so the integration is reusable
  outside the game.

**Trade-off:** `npm run dev` now runs Node instead of `npx serve`. The old
behaviour is preserved as `npm run dev:static` for contributors who don't want
to set up Telegram credentials.

### 2.7 Wrapper script for the Q&A tool (`scripts/qa.py`)

**Decision:** A pilot-local Python wrapper invokes `tool-project-qa` directly
via its `ProjectQATool` class, rather than relying on the upstream tool's
bundled CLI.

**Rationale:**
- The upstream `cli.py` instantiates a `_DummyContext` whose `get_contract`
  raises a bare `Exception("not found")`, but the tool only catches the
  specific `ToolNotFoundError`. The CLI therefore crashes on first use whenever
  optional contracts (`telegram-send`, `logger`) aren't wired in.
- The wrapper passes the proper `ToolContext` from the tool's own module, so
  optional contracts are gracefully absent and the tool runs cleanly.
- It also resolves `project_root: .` against the project directory rather than
  the caller's cwd, so `npm run qa -- --question "..."` and
  `scripts/qa.sh --question "..."` produce the same answer regardless of where
  they're invoked from.

**Trade-off:** A small amount of duplicated CLI surface in the consumer.
Acceptable for a pilot; once the upstream CLI is fixed, the wrapper can shrink
to a thin path-resolver or be deleted entirely.

---

## 3. Tooling choices outside the framework

| Concern | Choice | Why |
|---|---|---|
| Type checker / compiler | `typescript` 5.x | Only dev dep; matches the rest of the toolkit ecosystem. |
| Dev server | `npx serve` on port 3000 | Zero-config static server; avoids pulling in a full bundler. |
| Package manager | `npm` | Default Node tooling; lockfile committed for reproducibility. |
| Editor / runtime target | Modern Chrome | Project is meant to be opened in Chrome, so we lean on its ES2020 + Canvas support without polyfills. |
| Linting / formatting | None | Deferred — for a single-author pilot, strict TS catches enough. Easy to add ESLint + Prettier later. |
| Tests | None at the JS level | Game logic is small and visually verifiable. Tool repos carry their own pytest suites. |

---

## 4. What was deliberately left out

Listed here so future contributors don't think these are oversights:

- **Sound / music** — out of scope for a pilot; would require asset pipeline.
- **High-score persistence** — would need either localStorage (trivial) or a
  backend (out of scope).
- **Mobile / touch controls** — keyboard-only by design; the canvas size
  assumes a desktop viewport.
- **Multiplayer / network play** — the game state is intentionally local-only.
- **Full SRS rotation system** — see § 1.6.
- **CI pipeline for the game itself** — the consumed tools have CI; the game
  has no test suite to run yet.

---

## 5. Repo layout decisions

- **One repo per tool, one repo per composite project.** Pilot-tetris lives at
  `github.com/thf679/pilot-tetris`; tool-project-qa and tool-telegram-comms
  each have their own repos. This mirrors the toolkit-framework convention and
  keeps tool versioning independent of any consumer.
- **`DECISIONS.md` (this file) at the project root** rather than in `docs/`
  because it is short and is the document new contributors should read first
  after the README.
- **No `CHANGELOG.md` yet.** The project has not shipped a release; commit
  history is the source of truth until it does.

---

*Last updated: 2026-05-01.*
