// All drawing for LUMEN DRIFT: the arena, the ships, the HUD and the title /
// pause / game-over screens. No shadowBlur anywhere — glow comes from
// pre-rendered radial sprites, which stay fast even in software rendering.

import { FIELD, PLAYER } from './config.js';
import { SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, comboMultiplier } from './world.js';

const GLOW_COLORS = {
  cyan: '#4de8ff',
  red: '#ff5d73',
  purple: '#c77dff',
  amber: '#ffb020',
  gold: '#ffd94d',
  green: '#7dffb0',
  white: '#ffffff',
};

function makeGlowSprite(color) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return canvas;
}

function makeNebula() {
  const canvas = document.createElement('canvas');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const g = canvas.getContext('2d');
  const blobs = [
    { x: 220, y: 180, r: 340, color: 'rgba(64, 40, 140, 0.34)' },
    { x: 1050, y: 620, r: 380, color: 'rgba(16, 90, 120, 0.30)' },
    { x: 980, y: 140, r: 260, color: 'rgba(140, 40, 90, 0.22)' },
    { x: 320, y: 660, r: 280, color: 'rgba(30, 60, 140, 0.24)' },
  ];
  for (const b of blobs) {
    const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    grad.addColorStop(0, b.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  return canvas;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const sprites = {};
  for (const [name, color] of Object.entries(GLOW_COLORS)) sprites[name] = makeGlowSprite(color);
  const nebula = makeNebula();
  const bgGrad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  bgGrad.addColorStop(0, '#070b1d');
  bgGrad.addColorStop(1, '#12082e');

  function glow(sprite, x, y, size, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  function drawShip(x, y, angle, radius, color, invulnerable, time) {
    const blink = invulnerable > 0 && Math.floor(time * 14) % 2 === 0;
    if (blink) return;
    glow(sprites.cyan, x, y, radius * 5, 0.55);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(radius + 6, 0);
    ctx.lineTo(-radius * 0.7, radius * 0.75);
    ctx.lineTo(-radius * 0.35, 0);
    ctx.lineTo(-radius * 0.7, -radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.arc(radius * 0.25, 0, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    const pulse = 1 + Math.sin(time * 5 + enemy.wobble) * 0.06;
    const r = enemy.radius * pulse;
    const sprite = enemy.kind === 'weaver' ? sprites.purple : enemy.kind === 'splitter' || enemy.kind === 'mini' ? sprites.amber : sprites.red;
    glow(sprite, enemy.x, enemy.y, r * 4.6, 0.5);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle);
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
    if (enemy.kind === 'drifter' || enemy.kind === 'mini') {
      // Spiked shard.
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2;
        const rr = k % 2 === 0 ? r : r * 0.55;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'weaver') {
      // Ringed eye.
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0b2e';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(r * 0.2, 0, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'splitter') {
      // Hexagon core.
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a0b2e';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Warden: heavy crowned ring.
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#1a0b2e';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff2e63';
      ctx.beginPath();
      ctx.arc(r * 0.45, 0, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (enemy.kind === 'warden') {
      const w = 90;
      const pct = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 18, w, 6);
      ctx.fillStyle = '#ff2e63';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 18, w * pct, 6);
    }
  }

  function drawHeart(x, y, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = filled ? '#ff5d73' : 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-11, -4, -6, -12, 0, -6);
    ctx.bezierCurveTo(6, -12, 11, -4, 0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function panel(x, y, w, h, alpha) {
    ctx.fillStyle = `rgba(6, 10, 26, ${alpha})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function drawHud(world) {
    const player = world.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#eafcff';
    ctx.font = '700 30px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, 22, 16);
    ctx.font = '500 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(234, 252, 255, 0.65)';
    ctx.fillText(`BEST ${Math.max(world.best, world.score).toLocaleString('en-US')}`, 22, 50);
    const mult = comboMultiplier(world);
    if (mult > 1) {
      ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(`COMBO x${mult}`, 22, 72);
    }
    ctx.textAlign = 'center';
    ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#eafcff';
    ctx.fillText(`WAVE ${world.wave}`, FIELD.width / 2, 16);
    const left = world.director.queue.length + world.enemies.filter((e) => !e.ambient).length;
    ctx.font = '500 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(234, 252, 255, 0.65)';
    ctx.fillText(left > 0 ? `${left} HOSTILE${left === 1 ? '' : 'S'} LEFT` : 'WAVE CLEAR', FIELD.width / 2, 44);

    for (let i = 0; i < PLAYER.hull; i += 1) drawHeart(FIELD.width - 34 - i * 30, 30, i < player.hull);
    const barW = 150;
    const barX = FIELD.width - 22 - barW;
    const barY = 52;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(barX, barY, barW, 10);
    const pct = player.nova / PLAYER.novaNeed;
    ctx.fillStyle = pct >= 1 ? '#ffd94d' : '#2aa8c9';
    ctx.fillRect(barX, barY, barW * pct, 10);
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = pct >= 1 ? '#ffd94d' : 'rgba(234, 252, 255, 0.7)';
    ctx.fillText(pct >= 1 ? 'NOVA READY — E / RIGHT CLICK' : 'NOVA', FIELD.width - 22, 66);
    ctx.textAlign = 'left';
  }

  function drawBanner(world) {
    if (world.director.bannerTimer > 0) {
      const alpha = Math.min(1, world.director.bannerTimer);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = '800 44px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#eafcff';
      ctx.fillText(world.director.bannerText, FIELD.width / 2, 150);
      ctx.globalAlpha = 1;
    }
    if (world.breather > 0) {
      ctx.textAlign = 'center';
      ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#7dffb0';
      ctx.fillText(`NEXT WAVE IN ${Math.ceil(world.breather)}`, FIELD.width / 2, 120);
    }
  }

  function drawTitle(world) {
    ctx.fillStyle = 'rgba(4, 6, 18, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4de8ff';
    ctx.font = '800 84px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('LUMEN DRIFT', FIELD.width / 2, 150);
    ctx.fillStyle = '#eafcff';
    ctx.font = '500 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Harvest the light. Outlast the dark.', FIELD.width / 2, 250);
    ctx.font = '500 19px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(234, 252, 255, 0.85)';
    const lines = [
      'WASD / ARROWS — fly      MOUSE — aim      HOLD CLICK — fire',
      'SPACE — dash      E / RIGHT CLICK — Nova blast (when charged)',
      'Collect lumen orbs to charge Nova. Chain kills for combo score.',
      'Survive the waves. Every 5th wave wakes the Warden.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 330 + i * 34));
    const pulse = 0.65 + Math.sin(world.time * 4) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.font = '700 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffd94d';
    ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 510);
    ctx.globalAlpha = 1;
    if (world.best > 0) {
      ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(234, 252, 255, 0.7)';
      ctx.fillText(`BEST SCORE ${world.best.toLocaleString('en-US')}`, FIELD.width / 2, 560);
    }
    ctx.font = '500 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(234, 252, 255, 0.45)';
    ctx.fillText('P pause   ·   M mute   ·   R restart', FIELD.width / 2, 610);
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(4, 6, 18, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eafcff';
    ctx.font = '800 56px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('PAUSED', FIELD.width / 2, 300);
    ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(234, 252, 255, 0.8)';
    ctx.fillText('Press P or Enter to keep flying', FIELD.width / 2, 380);
  }

  function drawOver(world) {
    ctx.fillStyle = 'rgba(8, 4, 14, 0.68)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5d73';
    ctx.font = '800 64px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('SIGNAL LOST', FIELD.width / 2, 170);
    ctx.fillStyle = '#eafcff';
    ctx.font = '700 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`SCORE  ${world.score.toLocaleString('en-US')}`, FIELD.width / 2, 270);
    const isBest = world.score > 0 && world.score >= world.best;
    ctx.font = '600 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = isBest ? '#ffd94d' : 'rgba(234, 252, 255, 0.75)';
    ctx.fillText(isBest ? '★ NEW BEST SCORE ★' : `BEST  ${world.best.toLocaleString('en-US')}`, FIELD.width / 2, 322);
    ctx.fillStyle = 'rgba(234, 252, 255, 0.85)';
    ctx.font = '500 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`Reached wave ${world.wave}  ·  ${world.kills} hostiles destroyed`, FIELD.width / 2, 368);
    const pulse = 0.65 + Math.sin(world.time * 4) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.font = '700 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffd94d';
    ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', FIELD.width / 2, 450);
    ctx.globalAlpha = 1;
  }

  function draw(world) {
    const time = world.time;
    const shx = world.shake > 0 ? Math.sin(time * 127.1) * world.shake * 0.5 : 0;
    const shy = world.shake > 0 ? Math.cos(time * 141.3) * world.shake * 0.5 : 0;
    ctx.save();
    ctx.translate(shx, shy);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
    ctx.drawImage(nebula, 0, 0);
    for (const star of world.stars) {
      const tw = 0.45 + Math.sin(star.twinkle) * 0.35;
      ctx.globalAlpha = tw;
      ctx.fillStyle = star.layer === 2 ? '#cfe9ff' : '#ffffff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
    for (const orb of world.orbs) {
      const bob = Math.sin(orb.bob) * 2;
      const fade = orb.life < 2 ? (Math.floor(orb.life * 6) % 2 === 0 ? 0.4 : 1) : 1;
      glow(sprites.gold, orb.x, orb.y + bob, 30, 0.8 * fade);
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y + bob, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const enemy of world.enemies) drawEnemy(enemy, time);
    if (world.screen === SCREEN_PLAY || world.screen === SCREEN_PAUSE) {
      drawShip(world.player.x, world.player.y, world.player.angle, world.player.radius, '#4de8ff', world.player.invulnerable, time);
    }
    for (const bolt of world.bolts) {
      if (bolt.friendly) {
        glow(sprites.white, bolt.x, bolt.y, 22, 0.9);
        ctx.fillStyle = '#aef6ff';
        ctx.beginPath();
        ctx.arc(bolt.x, bolt.y, bolt.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        glow(sprites.red, bolt.x, bolt.y, 26, 0.85);
        ctx.fillStyle = '#ff8ba0';
        ctx.beginPath();
        ctx.arc(bolt.x, bolt.y, bolt.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const p of world.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = '700 17px "Segoe UI", system-ui, sans-serif';
    for (const f of world.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (world.novaFlash > 0) {
      ctx.fillStyle = `rgba(255, 233, 168, ${world.novaFlash * 0.35})`;
      ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
    }
    ctx.restore();

    if (world.screen === SCREEN_PLAY || world.screen === SCREEN_PAUSE) {
      drawHud(world);
      drawBanner(world);
    }
    if (world.screen === SCREEN_TITLE) drawTitle(world);
    if (world.screen === SCREEN_PAUSE) drawPause();
    if (world.screen === SCREEN_OVER) drawOver(world);
  }

  return { draw, ctx };
}
