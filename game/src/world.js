// The simulation for LUMEN DRIFT: one fixed-step world that owns the player,
// the enemies, the bullets, the score and the win/lose rules. The renderer
// only draws what is here; the autopilot only steers it.

import { COMBO, ENEMY, FIELD, ORB, PLAYER, STEP, WAVES } from './config.js';
import { makeRng } from './rng.js';
import { makeBolt, makeFloater, makeMini, makeOrb, makeParticle, makePlayer } from './entities.js';
import { makeDirector as newDirector, startWave, stepDirector, waveCleared } from './waves.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';

function loadBest() {
  try {
    return Number(window.localStorage.getItem('lumen-drift-best') || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem('lumen-drift-best', String(value));
  } catch {
    // Private mode or no storage: the best score just does not persist.
  }
}

function makeStars(rng) {
  const stars = [];
  for (let layer = 0; layer < 3; layer += 1) {
    const count = 46 - layer * 12;
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: rng.range(0, FIELD.width),
        y: rng.range(0, FIELD.height),
        size: (layer + 1) * 0.7,
        speed: (layer + 1) * 6,
        twinkle: rng.range(0, Math.PI * 2),
        layer,
      });
    }
  }
  return stars;
}

/** A fresh world. `audio` may be null (headless staging never needs sound). */
export function createWorld(seed, audio) {
  const world = {
    seed,
    rng: makeRng(seed),
    audio: audio || null,
    screen: SCREEN_TITLE,
    time: 0,
    player: makePlayer(),
    enemies: [],
    bolts: [],
    orbs: [],
    particles: [],
    floaters: [],
    stars: [],
    director: newDirector(),
    score: 0,
    best: loadBest(),
    wave: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    shake: 0,
    novaFlash: 0,
    breather: 0,
    stats: { shotsFired: 0, novasUsed: 0, wavesCleared: 0 },
  };
  world.stars = makeStars(world.rng);
  seedAmbient(world);
  return world;
}

/** A few harmless drifters wander behind the title screen, kept below the title text. */
function seedAmbient(world) {
  for (let i = 0; i < 6; i += 1) {
    const def = ENEMY.drifter;
    world.enemies.push({
      id: 1000 + i,
      kind: 'drifter',
      x: world.rng.range(80, FIELD.width - 80),
      y: world.rng.range(330, FIELD.height - 80),
      vx: world.rng.range(-40, 40),
      vy: world.rng.range(-40, 40),
      angle: world.rng.range(0, Math.PI * 2),
      radius: def.radius,
      hp: 99,
      maxHp: 99,
      speed: 40,
      score: 0,
      color: def.color,
      fireTimer: 0,
      orbitDir: 1,
      burstTimer: 0,
      chargeTimer: 0,
      flash: 0,
      wobble: world.rng.range(0, Math.PI * 2),
      ambient: true,
    });
  }
}

export function resetWorld(world, seed) {
  world.seed = seed;
  world.rng = makeRng(seed);
  world.screen = SCREEN_TITLE;
  world.time = 0;
  world.player = makePlayer();
  world.enemies = [];
  world.bolts = [];
  world.orbs = [];
  world.particles = [];
  world.floaters = [];
  world.stars = makeStars(world.rng);
  world.director = newDirector();
  world.score = 0;
  world.wave = 0;
  world.combo = 0;
  world.comboTimer = 0;
  world.kills = 0;
  world.shake = 0;
  world.novaFlash = 0;
  world.breather = 0;
  world.stats = { shotsFired: 0, novasUsed: 0, wavesCleared: 0 };
  seedAmbient(world);
}

export function startGame(world) {
  resetWorld(world, world.seed);
  // The title screen's ambient drifters stay behind; the arena starts clean.
  world.enemies = [];
  world.screen = SCREEN_PLAY;
  world.wave = 1;
  startWave(world.director, 1, world.rng);
  if (world.audio) world.audio.wave();
}

export function comboMultiplier(world) {
  return Math.min(1 + Math.floor(world.combo / 4), COMBO.max);
}

function addShake(world, amount) {
  world.shake = Math.min(14, world.shake + amount);
}

function burst(world, x, y, color, count, speed, life, size) {
  world.particles.push(...makeParticle(x, y, color, count, speed, life, size, world.rng));
}

function killEnemy(world, enemy, index) {
  const mult = comboMultiplier(world);
  const gained = enemy.score * mult;
  world.score += gained;
  world.kills += 1;
  world.combo += 1;
  world.comboTimer = COMBO.window;
  world.floaters.push(makeFloater(enemy.x, enemy.y - 18, `+${gained}`, mult > 1 ? '#ffd94d' : '#cfe9ff'));
  burst(world, enemy.x, enemy.y, enemy.color, enemy.kind === 'warden' ? 42 : 16, 260, 0.6, 3.2);
  if (world.audio) world.audio.explosion(enemy.kind === 'warden' || enemy.kind === 'splitter');
  if (enemy.kind === 'warden') {
    addShake(world, 12);
    world.novaFlash = 0.5;
  } else {
    addShake(world, 3);
  }
  const orbCount = enemy.kind === 'drifter' ? 1 : enemy.kind === 'weaver' ? 2 : enemy.kind === 'splitter' ? 2 : enemy.kind === 'warden' ? 8 : 0;
  for (let i = 0; i < orbCount; i += 1) world.orbs.push(makeOrb(enemy.x, enemy.y, world.rng));
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 3; i += 1) world.enemies.push(makeMini(enemy, world.rng));
  }
  world.enemies.splice(index, 1);
}

function hurtPlayer(world) {
  const player = world.player;
  if (player.invulnerable > 0 || player.dashTimer > 0) return;
  player.hull -= 1;
  player.invulnerable = PLAYER.invulnerableTime;
  world.combo = 0;
  world.comboTimer = 0;
  addShake(world, 10);
  burst(world, player.x, player.y, '#ff5d73', 22, 300, 0.7, 3.5);
  if (world.audio) world.audio.hurt();
  if (player.hull <= 0) {
    world.screen = SCREEN_OVER;
    if (world.score > world.best) {
      world.best = world.score;
      saveBest(world.best);
    }
    burst(world, player.x, player.y, '#4de8ff', 60, 420, 1.1, 4);
    if (world.audio) world.audio.gameOver();
  }
}

function fireNova(world) {
  const player = world.player;
  if (player.nova < PLAYER.novaNeed || world.screen !== SCREEN_PLAY) return;
  player.nova = 0;
  world.stats.novasUsed += 1;
  world.novaFlash = 0.9;
  addShake(world, 12);
  if (world.audio) world.audio.nova();
  world.bolts = world.bolts.filter((bolt) => bolt.friendly);
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    enemy.hp -= 8;
    enemy.flash = 0.25;
    if (enemy.hp <= 0) killEnemy(world, enemy, i);
  }
  burst(world, player.x, player.y, '#ffe9a8', 70, 520, 0.9, 4);
}

function stepPlayer(world, input, dt) {
  const player = world.player;
  const state = input.state;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.fireTimer = Math.max(0, player.fireTimer - dt);

  const dx = state.mouseX - player.x;
  const dy = state.mouseY - player.y;
  if (dx !== 0 || dy !== 0) player.angle = Math.atan2(dy, dx);

  if (state.dashQueued && player.dashCooldown <= 0 && player.dashTimer <= 0) {
    let mx = state.moveX;
    let my = state.moveY;
    if (mx === 0 && my === 0) {
      mx = Math.cos(player.angle);
      my = Math.sin(player.angle);
    }
    const len = Math.hypot(mx, my) || 1;
    player.dashX = (mx / len) * PLAYER.dashSpeed;
    player.dashY = (my / len) * PLAYER.dashSpeed;
    player.dashTimer = PLAYER.dashTime;
    player.dashCooldown = PLAYER.dashCooldown;
    if (world.audio) world.audio.dash();
  }
  state.dashQueued = false;

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.x += player.dashX * dt;
    player.y += player.dashY * dt;
  } else {
    const len = Math.hypot(state.moveX, state.moveY) || 1;
    if (state.moveX !== 0 || state.moveY !== 0) {
      player.vx += (state.moveX / len) * PLAYER.accel * dt;
      player.vy += (state.moveY / len) * PLAYER.accel * dt;
    }
    player.vx *= Math.pow(PLAYER.friction, dt * 60);
    player.vy *= Math.pow(PLAYER.friction, dt * 60);
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
  }
  player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(FIELD.height - player.radius, player.y));

  player.trailTimer -= dt;
  if ((Math.abs(player.vx) > 60 || Math.abs(player.vy) > 60) && player.trailTimer <= 0) {
    player.trailTimer = 0.03;
    world.particles.push(...makeParticle(player.x - Math.cos(player.angle) * 16, player.y - Math.sin(player.angle) * 16, '#2aa8c9', 1, 40, 0.35, 2.5, world.rng));
  }

  if (state.firing && player.fireTimer <= 0) {
    player.fireTimer = PLAYER.fireInterval;
    const nx = player.x + Math.cos(player.angle) * 20;
    const ny = player.y + Math.sin(player.angle) * 20;
    world.bolts.push(makeBolt(nx, ny, player.angle, PLAYER.boltSpeed, true));
    world.stats.shotsFired += 1;
    if (world.audio) world.audio.shoot();
  }
  if (state.novaQueued) fireNova(world);
  state.novaQueued = false;
}

function stepEnemies(world, dt) {
  const player = world.player;
  for (let i = 0; i < world.enemies.length; i += 1) {
    const enemy = world.enemies[i];
    if (enemy.ambient) {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.x < 40 || enemy.x > FIELD.width - 40) enemy.vx *= -1;
      if (enemy.y < 330 || enemy.y > FIELD.height - 40) enemy.vy *= -1;
      continue;
    }
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.wobble += dt * 3;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (enemy.kind === 'drifter' || enemy.kind === 'mini' || enemy.kind === 'splitter') {
      const wob = Math.sin(enemy.wobble) * 0.35;
      enemy.vx = (nx * Math.cos(wob) - ny * Math.sin(wob)) * enemy.speed;
      enemy.vy = (nx * Math.sin(wob) + ny * Math.cos(wob)) * enemy.speed;
      enemy.angle = Math.atan2(dy, dx);
    } else if (enemy.kind === 'weaver') {
      const want = 260;
      const radial = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
      const tx = nx * radial + -ny * enemy.orbitDir * 0.8;
      const ty = ny * radial + nx * enemy.orbitDir * 0.8;
      const tl = Math.hypot(tx, ty) || 1;
      enemy.vx = (tx / tl) * enemy.speed;
      enemy.vy = (ty / tl) * enemy.speed;
      enemy.angle = Math.atan2(dy, dx);
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && dist < 560) {
        enemy.fireTimer = 2.3;
        world.bolts.push(makeBolt(enemy.x, enemy.y, Math.atan2(dy, dx), 300, false));
        if (world.audio) world.audio.enemyShoot();
      }
    } else if (enemy.kind === 'warden') {
      enemy.vx = nx * enemy.speed;
      enemy.vy = ny * enemy.speed;
      enemy.angle = Math.atan2(dy, dx);
      enemy.burstTimer -= dt;
      if (enemy.burstTimer <= 0) {
        enemy.burstTimer = 3.4;
        for (let k = 0; k < 10; k += 1) {
          const a = (k / 10) * Math.PI * 2 + enemy.wobble;
          world.bolts.push(makeBolt(enemy.x, enemy.y, a, 220, false));
        }
        if (world.audio) world.audio.enemyShoot();
      }
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && dist < 620) {
        enemy.fireTimer = 1.9;
        for (let k = -1; k <= 1; k += 1) {
          world.bolts.push(makeBolt(enemy.x, enemy.y, Math.atan2(dy, dx) + k * 0.16, 330, false));
        }
      }
    }
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.x = Math.max(enemy.radius, Math.min(FIELD.width - enemy.radius, enemy.x));
    enemy.y = Math.max(enemy.radius, Math.min(FIELD.height - enemy.radius, enemy.y));
  }
}

function stepBolts(world, dt) {
  const player = world.player;
  for (let i = world.bolts.length - 1; i >= 0; i -= 1) {
    const bolt = world.bolts[i];
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;
    let dead = bolt.life <= 0 || bolt.x < -20 || bolt.x > FIELD.width + 20 || bolt.y < -20 || bolt.y > FIELD.height + 20;
    if (!dead && bolt.friendly) {
      for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = world.enemies[j];
        if (enemy.ambient) continue;
        const dx = bolt.x - enemy.x;
        const dy = bolt.y - enemy.y;
        const rr = bolt.radius + enemy.radius;
        if (dx * dx + dy * dy < rr * rr) {
          enemy.hp -= PLAYER.boltDamage;
          enemy.flash = 0.12;
          burst(world, bolt.x, bolt.y, '#aef6ff', 4, 160, 0.25, 2);
          if (enemy.hp <= 0) killEnemy(world, enemy, j);
          dead = true;
          break;
        }
      }
    } else if (!dead && !bolt.friendly) {
      const dx = bolt.x - player.x;
      const dy = bolt.y - player.y;
      const rr = bolt.radius + player.radius - 3;
      if (dx * dx + dy * dy < rr * rr) {
        hurtPlayer(world);
        dead = true;
      }
    }
    if (dead) world.bolts.splice(i, 1);
  }
}

function stepOrbs(world, dt) {
  const player = world.player;
  for (let i = world.orbs.length - 1; i >= 0; i -= 1) {
    const orb = world.orbs[i];
    orb.life -= dt;
    orb.bob += dt * 4;
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < PLAYER.magnetRadius) {
      orb.vx += (dx / dist) * 900 * dt;
      orb.vy += (dy / dist) * 900 * dt;
    } else {
      orb.vx *= 0.96;
      orb.vy *= 0.96;
    }
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    if (dist < player.radius + orb.radius + 4) {
      const wasFull = player.nova >= PLAYER.novaNeed;
      player.nova = Math.min(PLAYER.novaNeed, player.nova + ORB.value);
      world.score += ORB.score;
      world.floaters.push(makeFloater(orb.x, orb.y - 10, `+${ORB.score}`, '#ffd94d'));
      if (!wasFull && player.nova >= PLAYER.novaNeed && world.audio) world.audio.novaReady();
      else if (world.audio) world.audio.pickup();
      world.orbs.splice(i, 1);
    } else if (orb.life <= 0) {
      world.orbs.splice(i, 1);
    }
  }
}

function stepCollisions(world) {
  const player = world.player;
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    if (enemy.ambient) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const rr = player.radius + enemy.radius - 4;
    if (dx * dx + dy * dy < rr * rr) {
      hurtPlayer(world);
      const dist = Math.hypot(dx, dy) || 1;
      enemy.x -= (dx / dist) * 26;
      enemy.y -= (dy / dist) * 26;
      if (world.screen !== SCREEN_PLAY) return;
    }
  }
}

function stepParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.floaters.length - 1; i >= 0; i -= 1) {
    const f = world.floaters[i];
    f.y -= 42 * dt;
    f.life -= dt;
    if (f.life <= 0) world.floaters.splice(i, 1);
  }
  for (const star of world.stars) {
    star.y += star.speed * dt;
    star.twinkle += dt * 2;
    if (star.y > FIELD.height + 4) {
      star.y = -4;
      star.x = world.rng.range(0, FIELD.width);
    }
  }
  world.shake = Math.max(0, world.shake - dt * 26);
  world.novaFlash = Math.max(0, world.novaFlash - dt * 1.6);
}

function stepPlay(world, input, dt) {
  world.time += dt;
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }
  if (world.breather > 0) {
    world.breather -= dt;
    if (world.breather <= 0) {
      world.wave += 1;
      startWave(world.director, world.wave, world.rng);
      if (world.audio) world.audio.wave();
    }
  } else {
    stepDirector(world.director, world, dt);
    if (waveCleared(world.director, world)) {
      const bonus = WAVES.clearBonus * world.wave;
      world.score += bonus;
      world.stats.wavesCleared += 1;
      world.floaters.push(makeFloater(FIELD.width / 2, FIELD.height / 2 - 60, `WAVE CLEAR  +${bonus}`, '#7dffb0'));
      if (world.wave % WAVES.repairEvery === 0 && world.player.hull < PLAYER.hull) {
        world.player.hull += 1;
        world.floaters.push(makeFloater(FIELD.width / 2, FIELD.height / 2 - 30, 'HULL RESTORED +1', '#7dffb0'));
      }
      world.breather = WAVES.breather;
    }
  }
  stepPlayer(world, input, dt);
  if (world.screen !== SCREEN_PLAY) return;
  stepEnemies(world, dt);
  stepBolts(world, dt);
  if (world.screen !== SCREEN_PLAY) return;
  stepOrbs(world, dt);
  stepCollisions(world);
  stepParticles(world, dt);
}

/** One fixed step. `input` is the live input object or an autopilot-shaped one. */
export function stepWorld(world, input, dt = STEP) {
  if (world.screen === SCREEN_PLAY) {
    if (input.state.pauseQueued) {
      world.screen = SCREEN_PAUSE;
      input.state.pauseQueued = false;
      return;
    }
    stepPlay(world, input, dt);
    return;
  }
  if (world.screen === SCREEN_PAUSE) {
    if (input.state.pauseQueued || input.state.startQueued) world.screen = SCREEN_PLAY;
    input.state.pauseQueued = false;
    input.state.startQueued = false;
    return;
  }
  if (world.screen === SCREEN_TITLE) {
    world.time += dt;
    for (const enemy of world.enemies) {
      if (!enemy.ambient) continue;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.x < 40 || enemy.x > FIELD.width - 40) enemy.vx *= -1;
      if (enemy.y < 330 || enemy.y > FIELD.height - 40) enemy.vy *= -1;
    }
    stepParticles(world, dt);
    if (input.state.startQueued) {
      input.state.startQueued = false;
      startGame(world);
    }
    return;
  }
  // SCREEN_OVER
  world.time += dt;
  stepParticles(world, dt);
  if (input.state.restartQueued || input.state.startQueued) {
    input.state.restartQueued = false;
    input.state.startQueued = false;
    startGame(world);
  }
}
