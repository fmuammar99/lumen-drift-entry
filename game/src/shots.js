// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the
// real rules forward from a fresh world for a fixed time, steered by a simple
// autopilot that flies, aims and fires like a decent player, so every frame
// is what a short game really looks like — and the same seed always gives the
// same frame.

import { FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, resetWorld, startGame, stepWorld } from './world.js';
import { startWave } from './waves.js';

const SAMPLE_SECONDS = 1 / 30;

/** The autopilot: one input state per step, written into a fake input. */
function drive(world, input, skill) {
  const state = input.state;
  const player = world.player;
  state.moveX = 0;
  state.moveY = 0;
  state.firing = false;
  state.dashQueued = false;
  state.novaQueued = false;

  let nearestEnemy = null;
  let nearestDist = Infinity;
  for (const enemy of world.enemies) {
    if (enemy.ambient) continue;
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearestEnemy = enemy;
    }
  }
  let nearestOrb = null;
  let orbDist = Infinity;
  for (const orb of world.orbs) {
    const d = Math.hypot(orb.x - player.x, orb.y - player.y);
    if (d < orbDist) {
      orbDist = d;
      nearestOrb = orb;
    }
  }

  // Aim at the nearest enemy; fire when one is in range.
  if (nearestEnemy) {
    state.mouseX = nearestEnemy.x;
    state.mouseY = nearestEnemy.y;
    state.firing = nearestDist < 560;
  } else {
    state.mouseX = FIELD.width / 2;
    state.mouseY = FIELD.height / 2;
  }

  // Dodge: an enemy bolt closing in pushes the ship sideways.
  let mx = 0;
  let my = 0;
  for (const bolt of world.bolts) {
    if (bolt.friendly) continue;
    const d = Math.hypot(bolt.x - player.x, bolt.y - player.y);
    if (d < 90) {
      const bx = bolt.vx / (Math.hypot(bolt.vx, bolt.vy) || 1);
      const by = bolt.vy / (Math.hypot(bolt.vx, bolt.vy) || 1);
      mx += -by;
      my += bx;
    }
  }
  if (nearestEnemy && nearestDist < 100) {
    // Too close: back away.
    mx += (player.x - nearestEnemy.x) / nearestDist;
    my += (player.y - nearestEnemy.y) / nearestDist;
    if (skill === 'good') state.dashQueued = true;
  } else if (nearestOrb && orbDist < 320 && (!nearestEnemy || nearestDist > 160)) {
    mx += (nearestOrb.x - player.x) / orbDist;
    my += (nearestOrb.y - player.y) / orbDist;
  } else if (nearestEnemy) {
    // Close to firing range, but do not hug the enemy.
    const want = 300;
    const toward = nearestDist > want + 40 ? 1 : nearestDist < want - 60 ? -1 : 0;
    mx += ((nearestEnemy.x - player.x) / nearestDist) * toward;
    my += ((nearestEnemy.y - player.y) / nearestDist) * toward;
    // Strafe while shooting.
    const strafe = Math.sin(world.time * 1.7) > 0 ? 1 : -1;
    mx += (-(nearestEnemy.y - player.y) / nearestDist) * strafe * 0.7;
    my += ((nearestEnemy.x - player.x) / nearestDist) * strafe * 0.7;
  } else {
    mx += (FIELD.width / 2 - player.x) / FIELD.width;
    my += (FIELD.height / 2 - player.y) / FIELD.height;
  }
  const len = Math.hypot(mx, my) || 1;
  state.moveX = mx / len;
  state.moveY = my / len;

  if (skill === 'good' && player.nova >= 100) {
    const crowd = world.enemies.filter((e) => !e.ambient).length;
    if (crowd >= 5) state.novaQueued = true;
  }
}

/** Run the world forward for `seconds` with the autopilot driving. */
function simulate(world, input, seconds, skill) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.screen === SCREEN_OVER) break;
    drive(world, input, skill);
    stepWorld(world, input, STEP);
  }
}

/** A stand-in input the autopilot writes into, shaped like the real one. */
function fakeInput() {
  return {
    state: {
      moveX: 0,
      moveY: 0,
      mouseX: FIELD.width / 2,
      mouseY: FIELD.height / 2,
      firing: false,
      dashQueued: false,
      novaQueued: false,
      pauseQueued: false,
      restartQueued: false,
      startQueued: false,
      muteQueued: false,
    },
  };
}

/**
 * Set `world` to the named scene and return the screen to draw. The world
 * itself carries the step function; this only stages it.
 */
export function stageShot(name, world) {
  const input = fakeInput();
  resetWorld(world, 1);
  if (name === 'start') {
    for (let i = 0; i < 5 / STEP; i += 1) stepWorld(world, input, STEP);
    return SCREEN_TITLE;
  }
  if (name === 'boss') {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      resetWorld(world, attempt);
      startGame(world);
      simulate(world, input, 400, 'good');
      const warden = world.enemies.find((e) => e.kind === 'warden');
      if (warden && world.screen === SCREEN_PLAY) {
        simulate(world, input, 5, 'good');
        return SCREEN_PLAY;
      }
    }
    // Fallback: jump straight to a wave-5 warden fight so the frame still
    // shows the boss the real simulation produced.
    resetWorld(world, 1);
    startGame(world);
    world.enemies = [];
    world.director.queue = [];
    world.wave = 5;
    startWave(world.director, 5, world.rng);
    simulate(world, input, 14, 'good');
    return SCREEN_PLAY;
  }
  if (name === 'end') {
    resetWorld(world, 1);
    startGame(world);
    simulate(world, input, 40, 'good');
    // Then stop fighting: drift and wait for the arena to win.
    const passive = fakeInput();
    passive.state.mouseX = FIELD.width / 2;
    passive.state.mouseY = FIELD.height / 2;
    for (let i = 0; i < 240 / STEP && world.screen !== SCREEN_OVER; i += 1) {
      stepWorld(world, passive, STEP);
    }
    return SCREEN_OVER;
  }
  // play
  resetWorld(world, 1);
  startGame(world);
  simulate(world, input, 16, 'good');
  return world.screen === SCREEN_OVER ? SCREEN_OVER : SCREEN_PLAY;
}
