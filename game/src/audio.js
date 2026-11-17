// Procedural sound for LUMEN DRIFT: every effect is synthesized with WebAudio
// oscillators and filtered noise, so the game ships no audio files. The mixer
// starts on the first user gesture (browsers block audio before one) and stays
// silent when it cannot start — the game never depends on sound.

const MUSIC_BPM = 112;
const MUSIC_STEPS = [0, 0, 7, 0, 10, 0, 7, 5, 0, 0, 7, 0, 12, 10, 7, 5];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;
  let lastShootAt = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx !== null;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.14;
      musicGain.connect(master);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  function musicTick() {
    if (!ctx || muted) return;
    const stepDur = 60 / MUSIC_BPM / 2;
    const note = MUSIC_STEPS[musicStep % MUSIC_STEPS.length];
    const root = 110;
    const freq = root * Math.pow(2, note / 12);
    if (musicStep % 4 === 0) tone(root / 2, stepDur * 3.5, 'triangle', 0.5, null, 0);
    if (note > 0) {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * 2;
      gain.gain.setValueAtTime(0.16, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + stepDur * 0.9);
      osc.connect(gain).connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + stepDur);
    }
    musicStep += 1;
    musicTimer = setTimeout(musicTick, stepDur * 1000);
  }

  return {
    /** Call from any user gesture; safe to call repeatedly. */
    unlock() {
      if (ensure() && !musicTimer) musicTick();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      if (!ctx || muted) return;
      const now = performance.now();
      if (now - lastShootAt < 45) return;
      lastShootAt = now;
      tone(880, 0.09, 'square', 0.10, 220);
    },
    enemyShoot() {
      tone(320, 0.14, 'sawtooth', 0.07, 140);
    },
    explosion(big) {
      noise(big ? 0.5 : 0.28, big ? 0.5 : 0.3, big ? 900 : 1400);
      tone(big ? 90 : 140, big ? 0.4 : 0.22, 'sine', 0.35, 40);
    },
    pickup() {
      tone(660, 0.08, 'sine', 0.14, 990);
    },
    novaReady() {
      tone(523, 0.12, 'sine', 0.16);
      tone(784, 0.18, 'sine', 0.16, null, 0.1);
    },
    nova() {
      noise(0.9, 0.5, 500);
      tone(160, 0.8, 'sawtooth', 0.3, 40);
      tone(1200, 0.5, 'sine', 0.12, 200);
    },
    hurt() {
      tone(180, 0.25, 'sawtooth', 0.3, 60);
      noise(0.2, 0.25, 600);
    },
    dash() {
      noise(0.16, 0.18, 2400);
    },
    wave() {
      tone(392, 0.12, 'triangle', 0.18);
      tone(523, 0.12, 'triangle', 0.18, null, 0.11);
      tone(659, 0.22, 'triangle', 0.18, null, 0.22);
    },
    gameOver() {
      tone(392, 0.3, 'triangle', 0.2, 370);
      tone(311, 0.3, 'triangle', 0.2, 294, 0.28);
      tone(233, 0.7, 'triangle', 0.22, 220, 0.56);
    },
  };
}
