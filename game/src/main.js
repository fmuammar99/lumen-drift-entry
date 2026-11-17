// Bootstrap for LUMEN DRIFT: wires the canvas, the input, the world and the
// renderer together, runs the fixed-step loop, and exposes the test hooks the
// screenshotter and the play-test drive (window.__game, window.__shotReady).

import { FIELD, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, createWorld, startGame, stepWorld } from './world.js';

const canvas = document.getElementById('game');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot');

const audio = createAudio();
const input = createInput(canvas);
const world = createWorld(seed, audio);
const renderer = createRenderer(canvas);

window.__game = {
  world,
  input,
  start: () => startGame(world),
  /** Step the world n fixed steps (the play-test drives the game this way). */
  step(n = 1) {
    for (let i = 0; i < n; i += 1) stepWorld(world, input, STEP);
  },
  state() {
    return {
      screen: world.screen,
      score: world.score,
      best: world.best,
      wave: world.wave,
      hull: world.player.hull,
      nova: world.player.nova,
      enemies: world.enemies.filter((e) => !e.ambient).length,
      queue: world.director.queue.length,
      kills: world.kills,
      shotsFired: world.stats.shotsFired,
      novasUsed: world.stats.novasUsed,
    };
  },
};
window.__shotReady = false;
window.addEventListener('error', (event) => {
  window.__shotError = String(event.message || event.error || 'unknown error');
});

function unlockAudio() {
  audio.unlock();
}
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

canvas.addEventListener('click', () => {
  unlockAudio();
  if (world.screen === SCREEN_TITLE) startGame(world);
  else if (world.screen === SCREEN_OVER) startGame(world);
});

function frame(now) {
  if (input.state.muteQueued) {
    input.state.muteQueued = false;
    audio.setMuted(!audio.isMuted());
  }
  const dt = Math.min(0.1, (now - frame.last) / 1000 || 0);
  frame.last = now;
  frame.acc += dt;
  let guard = 0;
  while (frame.acc >= STEP && guard < 8) {
    stepWorld(world, input, STEP);
    frame.acc -= STEP;
    guard += 1;
  }
  if (guard === 8) frame.acc = 0;
  renderer.draw(world);
  requestAnimationFrame(frame);
}
frame.last = 0;
frame.acc = 0;

if (shot) {
  // A staged screenshot: simulate the scene, draw one frame, signal ready.
  stageShot(shot, world);
  renderer.draw(world);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
