// Local mirror of the best-game-01 scorer's five rows, run against a main.ts
// output directory. Usage: node check-gate.mjs <out-dir>
// Rows: game_files, references, screenshots, dossier_matches (+ js_parses info).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const out = process.argv[2] || '/tmp/out1';
let pass = 0;
let fail = 0;
function row(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (ok) pass += 1; else fail += 1;
}

function walk(dir, base = '') {
  let files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) files.push({ rel, symlink: true });
    else if (entry.isDirectory()) files = files.concat(walk(full, rel));
    else if (entry.isFile()) files.push({ rel, size: statSync(full).size });
  }
  return files;
}

// game_files
const gameFiles = walk(join(out, 'game'));
const gameBytes = gameFiles.reduce((s, f) => s + (f.size || 0), 0);
const indexHtml = gameFiles.find((f) => f.rel === 'index.html');
row('game_files', gameFiles.length <= 993 && gameBytes <= 48 * 1024 * 1024 && !gameFiles.some((f) => f.symlink) && indexHtml && indexHtml.size <= 1024 * 1024 && gameFiles.every((f) => Buffer.byteLength(f.rel) <= 1000),
  `${gameFiles.length} entries, ${gameBytes} bytes, index.html ${indexHtml ? indexHtml.size : 'MISSING'} bytes`);

// references: no network loads in index.html or any .js under game/
let badRefs = [];
const textFiles = gameFiles.filter((f) => /\.(html|js|mjs|css|json)$/.test(f.rel));
for (const f of textFiles) {
  const text = readFileSync(join(out, 'game', f.rel), 'utf8');
  const hits = text.match(/(https?:)?\/\/[a-z0-9-]+\.[a-z]{2,}|from\s+['"]https?:|src\s*=\s*['"]https?:/gi);
  if (hits) badRefs.push(`${f.rel}: ${hits.slice(0, 2).join(', ')}`);
  if (/fetch\s*\(|XMLHttpRequest|WebSocket\s*\(/.test(text)) badRefs.push(`${f.rel}: runtime network call`);
}
row('references', badRefs.length === 0, badRefs.length === 0 ? `${textFiles.length} text files, no external refs` : badRefs.join(' | '));

// screenshots: 3-4 files, <=256 KiB, JPEG/PNG, long side <=1280, short side >=480
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}
const shots = readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.')).sort();
let shotDetail = [];
let shotsOk = shots.length >= 3 && shots.length <= 4;
for (const name of shots) {
  const buf = readFileSync(join(out, 'screenshots', name));
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const dims = isJpeg ? jpegSize(buf) : isPng ? { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) } : null;
  const ok = (isJpeg || isPng) && buf.length <= 262144 && dims && Math.max(dims.width, dims.height) <= 1280 && Math.min(dims.width, dims.height) >= 480;
  if (!ok) shotsOk = false;
  shotDetail.push(`${name} ${buf.length}B ${dims ? `${dims.width}x${dims.height}` : '?'}`);
}
row('screenshots', shotsOk, shotDetail.join(' | '));

// dossier_matches: rebuild with main.ts into a scratch dir and compare bytes
execSync(`rm -rf /tmp/out-gate && MAKEFUN_OUTPUT_DIR=/tmp/out-gate ${process.execPath} main.ts`, { cwd: process.cwd(), stdio: 'ignore' });
const a = readFileSync(join(out, 'dossier.json'));
const b = readFileSync('/tmp/out-gate/dossier.json');
row('dossier_matches', a.equals(b) && a.length <= 1572864, `dossier.json ${a.length} bytes, rebuild ${a.equals(b) ? 'byte-identical' : 'DIFFERS'}`);

// js_parses
const checkOut = execSync(`for f in $(find ${join(out, 'game')} -name '*.js'); do ${process.execPath} --check "$f" 2>/dev/null || echo "FAIL $f"; done; echo DONE`, { encoding: 'utf8' });
const fails = checkOut.split('\n').filter((l) => l.startsWith('FAIL'));
const jsCount = textFiles.filter((x) => /\.m?js$/.test(x.rel)).length;
row('js_parses', fails.length === 0, `${jsCount - fails.length}/${jsCount} parse${fails.length ? ` — ${fails.join(', ')}` : ''}`);

console.log(`\n${pass}/${pass + fail} gate rows passed`);
process.exit(fail === 0 ? 0 : 1);
