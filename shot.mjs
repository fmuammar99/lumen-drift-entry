// CDP screenshotter for LUMEN DRIFT — Node 22 stdlib only (global WebSocket).
// Opens the game through a file:// redirector (so the navigation to the local
// server is not blocked by private-network-access checks), waits for
// window.__shotReady (set by the game's ?shot= hooks), collects console
// errors, and captures a JPEG at 1280x800.
// Usage: node shot.mjs <game-url> <out.jpg> [timeoutMs]
// Chrome must run with the hatch-webgl-all-origins-v1 policy file, --no-proxy-server,
// and --host-resolver-rules="MAP example.com 127.0.0.1" (see STATUS.md).
import { writeFileSync } from 'node:fs';

const [url, out, timeoutArg] = process.argv.slice(2);
const timeoutMs = Number.parseInt(timeoutArg || '60000', 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    errors.push(`exception: ${(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || '').slice(0, 400)}`);
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  } else if (msg.method === 'Network.loadingFailed') {
    errors.push(`netfail: ${msg.params.errorText}`);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id;
  pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

const started = Date.now();
let ready = false;
while (Date.now() - started < timeoutMs) {
  const result = await send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
  if (result.result && result.result.value === true) {
    ready = true;
    break;
  }
  const err = await send('Runtime.evaluate', { expression: 'window.__shotError || null', returnByValue: true });
  if (err.result && err.result.value) {
    console.error('page error:', err.result.value);
    process.exit(3);
  }
  await sleep(300);
}
if (!ready) {
  const where = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
  console.error('TIMEOUT waiting for __shotReady at', JSON.stringify(where.result ? where.result.value : where));
  console.error('errors:', JSON.stringify(errors, null, 2));
  process.exit(2);
}
await sleep(150);
const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('wrote', out);
if (errors.length > 0) console.log('page errors:', JSON.stringify(errors, null, 2));
ws.close();
process.exit(0);
