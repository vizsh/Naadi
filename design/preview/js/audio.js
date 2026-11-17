// "Hear what NAADI hears": physically modelled sound of the loom motor's
// drive-end bearing. Healthy = magnetic hum + shaft harmonics + broadband noise.
// Now = the same plus an impact every time a ball crosses the outer-race spall
// (at BPFO), each impact ringing the housing resonance near 3.2 kHz.
// Demodulated = what envelope analysis extracts: the 85.8 Hz knock on its own.
import { mulberry32, gauss, defectFactors, TRUE_RPM } from './model.js';

let ctx = null;
let playing = null;

function synth(kind, sr) {
  const dur = 3.2;
  const n = Math.floor(dur * sr);
  const x = new Float32Array(n);
  const rng = mulberry32(kind === 'base' ? 11 : 12);
  const fr = TRUE_RPM / 60;
  const bpfo = defectFactors().BPFO * fr;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0.22 * Math.sin(2 * Math.PI * 100 * t) + 0.07 * Math.sin(2 * Math.PI * 200 * t + 0.4);
    v += 0.06 * Math.sin(2 * Math.PI * fr * t) + 0.04 * Math.sin(2 * Math.PI * 2 * fr * t + 1.1);
    v += 0.05 * gauss(rng);
    x[i] = v;
  }
  if (kind !== 'base') {
    let t = 0.01;
    const ring = Math.floor(sr * 0.004);
    while (t < dur - 0.01) {
      const i0 = Math.floor(t * sr);
      const a = 0.62 * (0.8 + 0.4 * rng());
      for (let j = 0; j < ring && i0 + j < n; j++) {
        const tt = j / sr;
        x[i0 + j] += a * Math.exp(-tt / 0.00055) * Math.sin(2 * Math.PI * 3200 * tt);
      }
      t += (1 / bpfo) * (1 + 0.012 * (rng() - 0.5));
    }
  }
  if (kind === 'env') {
    // high-pass to drop the hum, rectify, low-pass: the envelope
    let hp = 0, prev = 0, lp = 0;
    const aH = 0.97, aL = 1 - Math.exp((-2 * Math.PI * 420) / sr);
    for (let i = 0; i < n; i++) {
      hp = aH * (hp + x[i] - prev);
      prev = x[i];
      lp += aL * (Math.abs(hp) - lp);
      x[i] = lp;
    }
    let mean = 0;
    for (let i = 0; i < n; i++) mean += x[i];
    mean /= n;
    for (let i = 0; i < n; i++) x[i] -= mean;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(x[i]));
  const g = 0.7 / peak, fade = Math.floor(sr * 0.03);
  for (let i = 0; i < n; i++) {
    const e = Math.min(1, i / fade, (n - 1 - i) / fade);
    x[i] *= g * e;
  }
  return x;
}

export function prepare(kind) {
  // AudioBuffer needs no context, so the waveform can be drawn before any click.
  const sampleRate = 44100;
  const data = synth(kind, sampleRate);
  const buf = new AudioBuffer({ length: data.length, numberOfChannels: 1, sampleRate });
  buf.copyToChannel(data, 0);
  return buf;
}

export async function play(buf, onEnd) {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') await ctx.resume();
  stop();
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.55;
  src.buffer = buf;
  src.connect(gain).connect(ctx.destination);
  src.onended = () => {
    if (playing === src) playing = null;
    onEnd && onEnd();
  };
  src.start();
  playing = src;
}

export function stop() {
  if (playing) {
    const p = playing;
    playing = null;
    try { p.stop(); } catch { /* already stopped */ }
  }
}
