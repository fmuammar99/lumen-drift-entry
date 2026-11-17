// The wave director for LUMEN DRIFT: decides what spawns, in what mix, and
// when a wave is won. The player never waits on an empty arena — a wave ends
// only when its queue is empty and every enemy is dead.

import { WAVES } from './config.js';
import { makeEnemy } from './entities.js';

/** Build the spawn queue for a wave: a shuffled mix weighted by wave number. */
export function buildWaveQueue(wave, rng) {
  const budget = WAVES.budgetBase + wave * WAVES.budgetPerWave;
  const queue = [];
  let spent = 0;
  while (spent < budget) {
    const roll = rng.next();
    let kind = 'drifter';
    if (wave >= 2 && roll < 0.22) kind = 'weaver';
    else if (wave >= 3 && roll < 0.38) kind = 'splitter';
    const cost = kind === 'drifter' ? 1 : kind === 'weaver' ? 2 : 3;
    if (spent + cost > budget + 2) kind = 'drifter';
    queue.push(kind);
    spent += kind === 'drifter' ? 1 : kind === 'weaver' ? 2 : 3;
  }
  // Shuffle so the mix does not arrive in clumps.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (wave % 5 === 0) queue.push('warden');
  return queue;
}

/** The director's per-wave state, reset by the world when a wave starts. */
export function makeDirector() {
  return {
    queue: [],
    spawnTimer: 0,
    breather: 0,
    bannerTimer: 0,
    bannerText: '',
  };
}

/** Start a wave: refill the queue and raise its banner. */
export function startWave(director, wave, rng) {
  director.queue = buildWaveQueue(wave, rng);
  director.spawnTimer = 0.4;
  director.bannerText = wave % 5 === 0 ? `WAVE ${wave} — THE WARDEN WAKES` : `WAVE ${wave}`;
  director.bannerTimer = 2.2;
}

/** Drip the queue into the arena, one enemy per interval. */
export function stepDirector(director, world, dt) {
  if (director.bannerTimer > 0) director.bannerTimer -= dt;
  if (director.queue.length === 0) return;
  director.spawnTimer -= dt;
  if (director.spawnTimer > 0) return;
  director.spawnTimer = WAVES.spawnInterval;
  const kind = director.queue.shift();
  const enemy = makeEnemy(kind, world.rng, world.wave);
  if (kind === 'warden') {
    enemy.x = 640;
    enemy.y = 90;
  }
  world.enemies.push(enemy);
}

/** A wave is clear when nothing is left to spawn and nothing is alive. */
export function waveCleared(director, world) {
  return director.queue.length === 0 && world.enemies.length === 0;
}
