// Entity factories for LUMEN DRIFT. Every moving thing in the arena is a plain
// object made here; the world steps them, the renderer draws them.

import { ENEMY, FIELD } from './config.js';

let nextId = 1;

export function makePlayer() {
  return {
    id: nextId,
    kind: 'player',
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: 14,
    hull: 3,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    invulnerable: 0,
    nova: 0,
    trailTimer: 0,
  };
}

/** Spawn point on a random arena edge, just inside the border. */
function edgePoint(rng) {
  const side = rng.int(0, 3);
  const m = 30;
  if (side === 0) return { x: rng.range(m, FIELD.width - m), y: m };
  if (side === 1) return { x: rng.range(m, FIELD.width - m), y: FIELD.height - m };
  if (side === 2) return { x: m, y: rng.range(m, FIELD.height - m) };
  return { x: FIELD.width - m, y: rng.range(m, FIELD.height - m) };
}

export function makeEnemy(kind, rng, wave) {
  const def = ENEMY[kind];
  const p = edgePoint(rng);
  const hpScale = kind === 'warden' ? 1 + (wave - 5) * 0.08 : 1 + Math.max(0, wave - 1) * 0.06;
  return {
    id: nextId,
    kind,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    angle: rng.range(0, Math.PI * 2),
    radius: def.radius,
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    speed: def.speed * rng.range(0.9, 1.15),
    score: def.score,
    color: def.color,
    fireTimer: rng.range(1.2, 2.4),
    orbitDir: rng.chance(0.5) ? 1 : -1,
    burstTimer: rng.range(2.5, 4.5),
    chargeTimer: 0,
    flash: 0,
    wobble: rng.range(0, Math.PI * 2),
  };
}

export function makeMini(parent, rng) {
  return {
    id: nextId,
    kind: 'mini',
    x: parent.x + rng.range(-14, 14),
    y: parent.y + rng.range(-14, 14),
    vx: rng.range(-160, 160),
    vy: rng.range(-160, 160),
    angle: rng.range(0, Math.PI * 2),
    radius: ENEMY.mini.radius,
    hp: 1,
    maxHp: 1,
    speed: ENEMY.mini.speed,
    score: ENEMY.mini.score,
    color: ENEMY.mini.color,
    fireTimer: 0,
    orbitDir: 1,
    burstTimer: 0,
    chargeTimer: 0,
    flash: 0,
    wobble: rng.range(0, Math.PI * 2),
  };
}

export function makeBolt(x, y, angle, speed, friendly) {
  return {
    id: nextId,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: friendly ? 5 : 7,
    friendly,
    life: 1.6,
  };
}

export function makeOrb(x, y, rng) {
  return {
    id: nextId,
    x,
    y,
    vx: rng.range(-40, 40),
    vy: rng.range(-40, 40),
    radius: 8,
    life: 9,
    bob: rng.range(0, Math.PI * 2),
  };
}

export function makeParticle(x, y, color, count, speed, life, size, rng) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + rng.range(0, 0.4);
    const s = speed * rng.range(0.4, 1);
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      color,
      life: life * rng.range(0.6, 1),
      maxLife: life,
      size: size * rng.range(0.6, 1.4),
    });
  }
  return parts;
}

export function makeFloater(x, y, text, color) {
  return { x, y, text, color, life: 0.9, maxLife: 0.9 };
}
