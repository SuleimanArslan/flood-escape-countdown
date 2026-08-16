let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicTimer: number | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setAudioEnabled(on: boolean) {
  enabled = on;
  if (master) master.gain.value = on ? 0.28 : 0;
}

export function isAudioEnabled() {
  return enabled;
}

type Wave = OscillatorType;

export function tone(freq: number, dur = 0.12, type: Wave = "sine", vol = 0.4, slideTo?: number) {
  const c = ac();
  if (!c || !master || !enabled) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(master);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

export function noise(dur = 0.2, vol = 0.25, filterHz = 900) {
  const c = ac();
  if (!c || !master || !enabled) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = filterHz;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export const sfx = {
  step: () => noise(0.09, 0.06, 500),
  splash: () => noise(0.28, 0.18, 1400),
  pickup: () => {
    tone(660, 0.08, "triangle", 0.3);
    setTimeout(() => tone(990, 0.12, "triangle", 0.25), 70);
  },
  interact: () => tone(420, 0.1, "square", 0.16),
  objective: () => {
    tone(523, 0.12, "sine", 0.3);
    setTimeout(() => tone(784, 0.18, "sine", 0.3), 110);
  },
  warn: () => tone(300, 0.25, "sawtooth", 0.16, 180),
  damage: () => tone(180, 0.2, "sawtooth", 0.22, 90),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.3, "triangle", 0.28), i * 130)),
  lose: () => [400, 320, 240, 150].forEach((f, i) => setTimeout(() => tone(f, 0.4, "sine", 0.26), i * 190)),
  click: () => tone(520, 0.05, "square", 0.12),
};

const MOTIF = [110, 146.83, 130.81, 98, 110, 164.81, 130.81, 98];

export function startMusic() {
  if (musicTimer !== null) return;
  let i = 0;
  const step = () => {
    const f = MOTIF[i % MOTIF.length] ?? 110;
    tone(f, 1.1, "sine", 0.12);
    if (i % 4 === 0) tone(f * 2, 1.6, "triangle", 0.05);
    i++;
  };
  step();
  musicTimer = window.setInterval(step, 1100);
}

export function stopMusic() {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}