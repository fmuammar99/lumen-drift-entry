// Keyboard and mouse for LUMEN DRIFT. The game reads this state once per
// fixed step; the autopilot in shots.js writes the same shape, so a staged
// screenshot plays through the real input path.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    moveX: 0,
    moveY: 0,
    mouseX: 0,
    mouseY: 0,
    firing: false,
    /** Edge-triggered actions, consumed once per step. */
    dashQueued: false,
    novaQueued: false,
    pauseQueued: false,
    restartQueued: false,
    startQueued: false,
    muteQueued: false,
  };

  function updateMove() {
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    const up = keys.has('KeyW') || keys.has('ArrowUp');
    const down = keys.has('KeyS') || keys.has('ArrowDown');
    state.moveX = (right ? 1 : 0) - (left ? 1 : 0);
    state.moveY = (down ? 1 : 0) - (up ? 1 : 0);
  }

  function toGameCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 800 / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space') state.dashQueued = true;
    if (event.code === 'KeyE') state.novaQueued = true;
    if (event.code === 'KeyP' || event.code === 'Escape') state.pauseQueued = true;
    if (event.code === 'KeyR') state.restartQueued = true;
    if (event.code === 'Enter') state.startQueued = true;
    if (event.code === 'KeyM') state.muteQueued = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    updateMove();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    updateMove();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    state.firing = false;
    updateMove();
  });
  canvas.addEventListener('mousemove', (event) => {
    const p = toGameCoords(event.clientX, event.clientY);
    state.mouseX = p.x;
    state.mouseY = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) state.firing = true;
    if (event.button === 2) state.novaQueued = true;
    const p = toGameCoords(event.clientX, event.clientY);
    state.mouseX = p.x;
    state.mouseY = p.y;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    state,
    /** The canvas element, for click-to-start / click-to-restart hit tests. */
    canvas,
    toGameCoords,
  };
}
