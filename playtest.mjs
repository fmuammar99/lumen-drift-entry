// Automated browser play-test for LUMEN DRIFT — Node 22 stdlib only (CDP).
// Loads the real game, drives it through window.__game (the same hooks a
// player would use: start, step, state), and checks the loop end to end:
// title -> play -> kills and score rise -> wave advances -> Nova fires ->
// game over -> restart. Fails loudly on any page error.
// Usage: node playtest.mjs [game-url]
import { readFileSync } from 'node:fs';

const url = process.argv[2] || 'http://127.0.0.1:8080/?seed=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const goUrl = `file:///tmp/go-game.html?to=${encodeURIComponent(url)}`;
const created = await fetch(`http://127.0.0.1:9222/json/new?${goUrl}`, { method: 'PUT' }).then((r) => r.json());
const ws = new WebSocket(created.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(JSON.stringify(msg.error)));
    else res(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(`exception: ${(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || '').slice(0, 300)}`);
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id;
  pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await sleep(2500);

check('game loads, no page error', errors.length === 0, errors.join(' | '));
check('title screen shows', (await evalJs(`window.__game.state().screen`)) === 'title');

// Start the game through the real start path.
await evalJs(`window.__game.start()`);
check('start switches to play', (await evalJs(`window.__game.state().screen`)) === 'play');

// Hold fire toward the nearest enemy and strafe, like a player would.
await evalJs(`(() => {
  const g = window.__game;
  g.__auto = setInterval(() => {
    const w = g.world;
    const p = w.player;
    let best = null, bd = 1e9;
    for (const e of w.enemies) {
      if (e.ambient) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      g.input.state.mouseX = best.x;
      g.input.state.mouseY = best.y;
      g.input.state.firing = bd < 560;
      const strafe = Math.sin(w.time * 1.7) > 0 ? 1 : -1;
      g.input.state.moveX = Math.cos(Math.atan2(best.y - p.y, best.x - p.x) + Math.PI / 2) * strafe * 0.6;
      g.input.state.moveY = Math.sin(Math.atan2(best.y - p.y, best.x - p.x) + Math.PI / 2) * strafe * 0.6;
    }
  }, 50);
  return true;
})()`);
await sleep(12000);
const mid = await evalJs(`window.__game.state()`);
check('kills happen', mid.kills >= 3, `${mid.kills} kills`);
check('score rises', mid.score > 0, `score ${mid.score}`);
check('shots fired', mid.shotsFired > 20, `${mid.shotsFired} shots`);
check('player still alive mid-game', mid.hull > 0, `hull ${mid.hull}`);

// Nova: charge it up and fire.
await evalJs(`(() => { window.__game.world.player.nova = 100; window.__game.input.state.novaQueued = true; return true; })()`);
await sleep(500);
const afterNova = await evalJs(`window.__game.state()`);
check('nova fires and resets charge', afterNova.novasUsed === 1, `novasUsed ${afterNova.novasUsed}`);

// Dash.
await evalJs(`(() => { const s = window.__game.input.state; s.moveX = 1; s.dashQueued = true; return true; })()`);
await sleep(300);
check('dash triggers', (await evalJs(`window.__game.world.player.dashCooldown > 0`)) === true);

// Keep playing until the wave advances or the game ends (cap 60 s).
let end = null;
for (let i = 0; i < 60; i += 1) {
  await sleep(1000);
  end = await evalJs(`window.__game.state()`);
  if (end.wave >= 2 || end.screen === 'over') break;
}
check('wave advances or game ends', end.wave >= 2 || end.screen === 'over', `wave ${end.wave}, screen ${end.screen}`);

// Force game over if still alive, then restart.
if (end.screen !== 'over') {
  await evalJs(`(() => { const w = window.__game.world; w.player.hull = 1; w.player.invulnerable = 0; const e = w.enemies.find(e => !e.ambient); if (e) { e.x = w.player.x; e.y = w.player.y; } return true; })()`);
  await sleep(1500);
}
const over = await evalJs(`window.__game.state()`);
check('game over screen shows', over.screen === 'over', `screen ${over.screen}`);
check('game over keeps a score', over.score > 0, `score ${over.score}`);

// Restart with R (the real key path).
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82 });
await sleep(800);
const restarted = await evalJs(`window.__game.state()`);
check('R restarts the game', restarted.screen === 'play' && restarted.score === 0 && restarted.wave === 1, `screen ${restarted.screen}, score ${restarted.score}`);

// Pause and resume.
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 });
await sleep(400);
check('P pauses', (await evalJs(`window.__game.state().screen`)) === 'pause');
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 });
await sleep(400);
check('P resumes', (await evalJs(`window.__game.state().screen`)) === 'play');

await evalJs(`clearInterval(window.__game.__auto)`);
check('no page errors at the end', errors.length === 0, errors.join(' | '));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
ws.close();
process.exit(failed === 0 ? 0 : 1);
