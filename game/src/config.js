// Tuning for LUMEN DRIFT: one place for every number the game balances on,
// so a tweak never means hunting through the simulation.
export const FIELD = { width: 1280, height: 800 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  accel: 2600,
  maxSpeed: 360,
  friction: 0.86,
  hull: 3,
  fireInterval: 0.13,
  boltSpeed: 680,
  boltDamage: 1,
  boltRadius: 5,
  dashSpeed: 900,
  dashTime: 0.16,
  dashCooldown: 1.1,
  invulnerableTime: 1.4,
  novaNeed: 100,
  magnetRadius: 110,
};

export const ENEMY = {
  drifter: { radius: 16, hp: 2, speed: 130, score: 50, cost: 1, color: '#ff5d73' },
  weaver: { radius: 15, hp: 3, speed: 105, score: 100, cost: 2, color: '#c77dff' },
  splitter: { radius: 22, hp: 4, speed: 70, score: 150, cost: 3, color: '#ffb020' },
  mini: { radius: 10, hp: 1, speed: 210, score: 25, cost: 0, color: '#ffb020' },
  warden: { radius: 48, hp: 70, speed: 62, score: 1000, cost: 0, color: '#ff2e63' },
};

export const WAVES = {
  budgetBase: 6,
  budgetPerWave: 4,
  spawnInterval: 0.55,
  breather: 2.5,
  clearBonus: 100,
  repairEvery: 3,
};

export const COMBO = { window: 2.5, max: 8 };
export const ORB = { value: 10, score: 25, life: 9 };

export const COLORS = {
  bgTop: '#070b1d',
  bgBottom: '#12082e',
  player: '#4de8ff',
  bolt: '#aef6ff',
  orb: '#ffd94d',
  nova: '#ffe9a8',
};
