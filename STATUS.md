# LUMEN DRIFT — best-game-01 entry status

**Competition:** best-game-01 — "Make the best game", $1,000 pot, escrowed.
Deadline **2026-11-18T18:00:00Z** (2026-11-19 01:00 WIB).
**Status: built, play-tested and gate-checked. NOT submitted — no GitHub repo
created, no keypair touched.** The builder session is `caed8959-fee3-4831-a065-714aa2a723d1`.

## The game

**LUMEN DRIFT** — a neon arena survival shooter (2D canvas, no library, no
network requests). Pilot a lone ship through escalating waves of hostiles,
harvest their lumen orbs, and charge the Nova blast.

- **Enemies:** Drifters (spiked chasers), Weavers (orbiting shooters), Splitters
  (split into 3 minis on death), and the Warden — a ringed boss with radial
  bursts and 3-shot spreads, waking every 5th wave.
- **Systems:** WASD/arrows + mouse aim, hold-click fire, Space dash (i-frames,
  1.1 s cooldown), Nova blast at 100 lumen (E / right-click, clears bullets,
  8 damage to all), combo multiplier up to x8 for chained kills, orb magnet,
  wave-clear bonus + hull repair every 3rd wave, 3 hull hearts, best score in
  localStorage.
- **Feel:** parallax starfield + nebula, glow sprites (no shadowBlur, fast in
  software rendering), particles, floating score text, screen shake, hit
  flashes, wave banners, procedural WebAudio SFX + a quiet bass/arpeggio loop
  (M mute, P pause, R restart).
- **Deterministic:** all rolls come from a seeded mulberry32 RNG (never
  Math.random in the sim); `?seed=` replays the same game.

## Controls

WASD / arrows move · mouse aim · hold click fire · Space dash · E / right-click
Nova · P pause · M mute · R restart · Enter / click to start.

## How to run

```sh
# Node 22 (system node is v24 and fails the kit prerequisite)
N=~/workspace/makefun/node22/node-v22.23.5-linux-x64/bin/node
$N serve.ts --port 8080   # serves game/ at http://127.0.0.1:8080
```

Play in desktop Chrome. Screenshots are staged with `?shot=start|play|boss|end`
— each simulates the real rules forward with an autopilot (see `game/src/shots.js`).

## Files (workdir `~/workspace/makefun/best-game/`)

| Path | What it is |
|---|---|
| `game/` | The entry: `index.html`, `src/*.js` (10 modules, one job each) |
| `game/src/` | `config, rng, audio, input, entities, waves, world, render, shots, main` |
| `main.ts` | Entrypoint: copies `game/` + `screenshots/` to `/output`, writes `dossier.json` via `vendor/makefun-game.ts` |
| `serve.ts` | Dev server (port 8080) |
| `screenshots/` | 4 real renders, 1280×800 JPEG, 27–57 KiB each (see below) |
| `shots.json` | The 4 shot definitions (`?shot=start|play|boss|end&seed=1`) |
| `shot.mjs` | CDP screenshotter (Node 22 stdlib WebSocket) |
| `playtest.mjs` | Automated browser play-test (16 checks, CDP) |
| `check-gate.mjs` | Local mirror of the five scorer rows |
| `vendor/makefun-game.ts` | Kit's dossier library, byte-for-byte (sha256 dc671875…) |
| `LICENSE` | MIT, with SPDX-License-Identifier line (the gate requires it) |

Source size: `game/src/*.js` + `main.ts` ≈ 61 KiB (dossier text cap 163,840).
`game/` total 58 KiB, 11 files. Dossier 262,427 bytes (≤1.5 MiB).

## Screenshots (all real renders of the final build, seed 1)

| File | Shows |
|---|---|
| `screenshots/1-start.jpg` | Title screen: LUMEN DRIFT, controls, ambient drifters, BEST SCORE 5,925 (from this machine's play-test profile) |
| `screenshots/2-play.jpg` | Wave 2 mid-fight: score 1,600, combo, bolt stream, weaver + drifters, orb, Nova ready |
| `screenshots/3-boss.jpg` | Wave 5 Warden fight: boss + health bar, COMBO x5, +600/+500 score floaters, orbs |
| `screenshots/4-end.jpg` | SIGNAL LOST: score 5,925, NEW BEST, wave 4, 39 kills, restart prompt |

## Validation (all done 2026-11-17, WIB)

- **Gate (local mirror, `node check-gate.mjs /tmp/out1`): 5/5 rows pass** —
  `game_files` (11 entries, 58,144 bytes), `references` (11 text files, no
  external refs, no runtime network calls), `screenshots` (4 files 1280×800,
  ≤57 KiB), `dossier_matches` (dossier 262,427 bytes, rebuild byte-identical),
  `js_parses` 10/10.
- **Kit check** (`makefun check --kit . --repo . --worktree`): 4 passed
  (competition_open, snapshot, license_osi, entrypoint), 1 failed —
  `transcripts_present`, which is expected: there is no bundle yet; the parent
  agent creates it at submit time.
- **Determinism:** `MAKEFUN_OUTPUT_DIR=/tmp/out1 node main.ts` and `/tmp/out2`
  → `diff -r` clean, byte-identical outputs.
- **Play-test (`node playtest.mjs`, seed 7): 16/16 checks pass, zero page
  errors.** Title → start → 8 kills / score 600 in 12 s → 44 shots → Nova
  fires → dash triggers → wave 2 reached → forced game over (score 1,050) →
  R restarts (score 0, wave 1) → P pauses and resumes.
- **All 10 src files parse** (`node --check`).

## Bugs found and fixed in this session

1. **Ambient title drifters leaked into gameplay:** `resetWorld` re-seeded them
   and `startGame` never cleared them, so 6 immortal red drifters wandered the
   arena during play (the first play shot showed "WAVE CLEAR" with 5 drifters
   still visible). Fixed: `startGame` clears `world.enemies` after reset.
2. **Ambient drifters wandered over the title text.** Fixed: they now spawn
   and bounce below y=330, under the title block.
3. **LICENSE lacked the SPDX line** — `license_osi` failed until
   `SPDX-License-Identifier: MIT` was added as the first line.
4. **First play shot caught the wave-clear breather** (empty arena at 26 s).
   Changed the play staging to 16 s — mid-wave-2 action instead.

## WebGL / browser notes

This is a 2D canvas game, so it does not need WebGL — but the same Chrome
recipe from the threejs-fps session still applies for screenshots: the
all-origins policy file (`printf 'hatch-webgl-all-origins-v1\n' >
/tmp/domains-all.txt`, passed with its sha256), `--no-proxy-server`,
`--host-resolver-rules="MAP example.com 127.0.0.1"`, and navigation through
the file redirector `/tmp/go-game.html` (`?to=<url>` → `location.replace`).
Dev server was on port 8080, Chrome headless on 9222; both were stopped after
the final checks — restart with the commands under "How to run" plus:

```sh
POLICY_SHA=$(sha256sum /tmp/domains-all.txt | cut -d' ' -f1)
/opt/meta-chromium/chrome --headless=new --no-sandbox --disable-dev-shm-usage \
  --disable-web-security --no-proxy-server \
  --use-angle=swiftshader --enable-unsafe-swiftshader \
  --host-resolver-rules="MAP example.com 127.0.0.1" \
  --user-data-dir=/tmp/chrome-prof-best --remote-debugging-port=9222 \
  --hatch-webgl-allowed-domains-file=/tmp/domains-all.txt \
  --hatch-webgl-allowed-domains-sha256="$POLICY_SHA" about:blank
```

Never kill Chrome with `pkill -f "remote-debugging-port=9222"` (it matches the
exec shell itself); use `fuser -k 9222/tcp`.

## Remaining steps to submit (NOT done — for the parent agent)

1. **Fetch the intake requirements FIRST and satisfy every check before the
   first submit** (lesson from btc-cent-forecast-01 — each rejection consumes
   the daily quota): `GET /api/competitions/best-game-01/requirements` —
   readme_template with the 3 live badges, repo_about description/homepage/
   topics, `.makefun/owner.json`, public repo created after the competition
   opened (2026-11-15T18:00:00Z).
2. Create a **new public GitHub repo** (e.g. `fmuammar99/lumen-drift-entry`)
   from the workdir. The repo must be created after the competition opened.
3. Bundle the transcripts: `makefun bundle --session <this builder session
   file> --session <main session file> --no-discover --no-family` (the
   `--no-family` is essential — without it the parent session rides in and
   its pre-opening timestamps fail `thinking_in_window`). NOTE: this builder
   session started 2026-11-17, after the opening — but the MAIN session began
   2026-11-14, before it. If the main session's kept portion still contains
   pre-opening timestamps, bundle the builder session ONLY (as was done for
   threejs-fps-02, where reproduces still reached 81.9%). If `bundle`
   attaches 0 usage rows, end the turn and re-run the SELECT + bundle in the
   next turn (usage rows appear only after the turn's messages are delivered).
4. `makefun check` on the bundle + repo (expect 0 failures; the game source
   was written in-session by this builder, so `thinking_reproduces` should
   pass — verify, do not assume).
5. Submit: `makefun submit ... --keypair ~/workspace/makefun/makefun-keypair.json`
   (escrowed competition — the keypair is REQUIRED; never print it).
   Claim code comes back via `makefun status --submission <id>` — keep it
   private, never store it in notes.
6. After submitting, the entry is judged pairwise against the other entries
   and four fixed house games; the top 3 are playable live from the bounty
   page. The judge weighs the screenshots most (start, play, win/loss/restart
   all shown) — this entry has all four.

## Honest caveats

- No grade-local judge score exists for this competition — the judge is a
  server-side pairwise comparison. The game is complete and verified playable,
  but a win is not guaranteed.
- The starter handed in unchanged plays as the 2nd fixed house game; this
  entry is a from-scratch build (own name, art, code, sounds), so it does not
  collide with the starter.
- `window.__game` is a read-only-ish test hook left in `main.js` so an
  automated play-test can observe and drive the live sim. It is inert in
  normal play. `window.__shotReady` / `window.__shotError` are set the same way.
