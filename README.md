# pilot-tetris

A vanilla TypeScript Tetris game built as a **composite toolkit-framework
project**. It runs entirely in Chrome using a Canvas 2D renderer and a custom
`requestAnimationFrame` loop.

> Repo: <https://github.com/thf679/pilot-tetris>

See [`DECISIONS.md`](DECISIONS.md) for the architecture rationale and
trade-offs behind the choices below.

---

## Clone and play (Chrome)

```bash
# 1. Clone the repo
git clone https://github.com/thf679/pilot-tetris.git
cd pilot-tetris

# 2. Install dev dependencies (just TypeScript)
npm install

# 3. Compile TypeScript -> dist/
npm run build

# 4. Serve the static site on http://localhost:3000
npm run dev
```

Open Chrome and navigate to <http://localhost:3000>. The game starts
immediately — no extra setup is required to play.

### Requirements

- **Node.js 18+** (for `npm` and `npx serve`)
- **Modern Chrome** (or any evergreen browser with native ES module + Canvas
  2D support)

---

## Gameplay

- **Goal:** stack tetrominoes to fill complete horizontal lines. Cleared lines
  award points and increase your level.
- **Game over:** triggered when a new piece cannot spawn at the top of the
  board.
- **Ghost piece:** a faint outline shows where the active piece will land.
- **Scoring:**

  | Lines cleared at once | Points (× current level) |
  |-----------------------|--------------------------|
  | 1                     | 100                      |
  | 2                     | 300                      |
  | 3                     | 500                      |
  | 4 (Tetris)            | 800                      |

- **Level up:** every 10 lines cleared raises the level and shortens the drop
  interval. The drop speed bottoms out at 100 ms per cell.

### Controls

| Key       | Action                              |
|-----------|-------------------------------------|
| `←`       | Move piece left                     |
| `→`       | Move piece right                    |
| `↑`       | Rotate clockwise                    |
| `↓`       | Soft drop (faster fall, +1 / cell)  |
| `Space`   | Hard drop (instant, +2 / cell)      |
| `P`       | Pause / resume                      |
| `R`       | Restart (works during game over)    |

---

## Project structure

```
pilot-tetris/
├── README.md
├── DECISIONS.md          # Architectural decisions & trade-offs
├── package.json
├── package-lock.json
├── tsconfig.json
├── index.html            # Chrome entry point
├── style.css             # Game UI styling
├── server.mjs            # Node dev server + /api/notify Telegram proxy
├── tools.lock            # Pinned toolkit-framework tool versions
├── .gitignore
├── src/
│   ├── main.ts           # Entry point: wires input, loop, renderer, notify
│   ├── game.ts           # Game engine: state, loop, scoring, lock delay
│   ├── board.ts          # Board grid, collision, line clearing
│   ├── tetromino.ts      # Piece definitions, spawn, rotation, wall kicks
│   ├── renderer.ts       # Canvas drawing & HUD updates
│   ├── input.ts          # Keyboard mapping
│   ├── notify.ts         # Browser-side game-over notification helper
│   ├── types.ts          # Shared TypeScript types
│   └── constants.ts      # Grid size, colors, scoring tables
├── scripts/
│   ├── notify.sh         # Send a Telegram message via the gitignored config
│   ├── qa.sh             # Wrapper around qa.py
│   └── qa.py             # Run tool-project-qa from this project directory
├── config/               # Per-tool configuration for the framework
│   ├── project-qa.yaml
│   ├── telegram-comms.yaml         # gitignored (local secrets)
│   └── telegram-comms.yaml.example # template for contributors
└── tools/                # Populated by the framework bootstrap (gitkeep'd otherwise)
    ├── project-qa/
    └── telegram-comms/
```

---

## Scripts

| Script                | Description                                                             |
|-----------------------|-------------------------------------------------------------------------|
| `npm run build`       | Compile TypeScript to `dist/`                                           |
| `npm run dev`         | Start the Node dev server (serves files **and** proxies Telegram)       |
| `npm run dev:static`  | Static-only fallback — `npx serve` on port 3000, no notifications        |
| `npm run notify -- "msg"` | Send a Telegram message via the gitignored config                   |
| `npm run qa -- --question "..."` | Ask the project-qa tool a question                           |
| `npm run clean`       | Remove the compiled `dist/` directory                                   |

---

## Toolkit-framework integration

This repo follows the `toolkit-framework` repo-per-tool conventions:

- `tools.lock` pins exact tool versions so consumer environments stay
  reproducible.
- An optional `tools.local.yaml` (gitignored) can override registry sources
  with local checkouts during development.
- Run the framework's `bootstrap.py` to clone the listed tools into `tools/`.

### Tool dependencies

| Tool                  | Provides                              | Repo                                                |
|-----------------------|---------------------------------------|-----------------------------------------------------|
| `tool-project-qa`     | Q&A over indexed source files         | <https://github.com/thf679/tool-project-qa>         |
| `tool-telegram-comms` | `telegram-send` contract              | <https://github.com/thf679/tool-telegram-comms>     |

### Configuration

#### `config/project-qa.yaml`

```yaml
index_paths:
  - src
  - README.md
project_root: .
```

Indexes everything under `src/` plus this README so the QA tool can answer
questions about the codebase and the gameplay rules.

#### `config/telegram-comms.yaml`

This file is **gitignored**. To enable the Telegram integration:

```bash
cp config/telegram-comms.yaml.example config/telegram-comms.yaml
# then edit config/telegram-comms.yaml and fill in:
#   bot_token: "<your bot token>"
#   chat_id:   "<your chat id>"
```

### Wiring (game → Telegram)

The browser game and the Telegram bot are bridged by a tiny Node dev server
(`server.mjs`):

1. The game state transitions to `gameOver` when a new piece can't spawn.
2. `src/main.ts` calls `notifyGameOver(...)` once per game-over event.
3. `src/notify.ts` POSTs `{ score, lines, level }` to `/api/notify` on the
   local dev server.
4. `server.mjs` reads the gitignored `config/telegram-comms.yaml`, formats
   the message, and forwards it to the Telegram Bot API.

The bot token never reaches the browser — only the dev server (which has read
access to the YAML) can talk to Telegram. See `DECISIONS.md` § 2.6 for the
trade-off discussion.

The `tool-project-qa` ⇄ `tool-telegram-comms` contract wiring described in
the framework docs is the same idea applied to the Python tools: each
answered question optionally fires a notification.

### Example usage

#### Browser

`npm run dev`, open <http://localhost:3000>, play, then deliberately top out
the board. A Telegram message like:

```
🎮 pilot-tetris — game over
Final score: 1230
Lines cleared: 4
Level reached: 1
```

lands in the configured chat within a second of game over.

#### Standalone CLI

```bash
# Send any Telegram message via the gitignored config
npm run notify -- "Game deployment started"
# or directly
scripts/notify.sh "Build finished"

# Ask a question about the codebase
npm run qa -- --question "How does scoring work?"
# or directly
scripts/qa.sh --question "What are the controls?"
```

#### Programmatic (inside the framework)

```python
from framework import Framework

fw = Framework("tools.lock")
fw.load()

qa = fw.tools["project-qa"]
result = qa.answer("What are the controls?")
print(result["answer"])

comms = fw.tools["telegram-comms"]
comms.send_message("Game session finished")
```

---

## Contributing

1. Fork and clone.
2. `npm install && npm run build && npm run dev` — confirm the game runs.
3. (Optional) Copy `config/telegram-comms.yaml.example` to
   `config/telegram-comms.yaml` and fill in your own credentials before
   exercising the toolkit integration.
4. Open a PR from a feature branch — see the toolkit-framework's
   `tool-git-manager` for conventions (`feature/<ticket>-<slug>`,
   `bugfix/<ticket>-<slug>`, …).

---

## License

MIT. See [`LICENSE`](LICENSE) when published, or the `MIT License` reference
in `package.json`.
