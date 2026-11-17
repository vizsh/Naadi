// "Hear what NAADI hears": physically modelled sound of the loom motor's drive-end bearing.
// Healthy = 100 Hz magnetic hum + shaft harmonics + broadband noise. Now = the same plus an
// impact at every ball pass over the outer-race spall (BPFO), ringing the housing near
// 3.2 kHz. Demodulated = what envelope analysis extracts: the knock on its own.
import { gauss, mulberry32 } from '@/lib/model/core';
import { defectFactors, TRUE_RPM } from '@/lib/model/physics';

export type SoundKind = 'base' | 'now' | 'env';
const SR = 44100;

export function synth(kind: SoundKind, dur = 3.2): Float32Array {
  const n = Math.floor(dur * SR);
  const x = new Float32Array(n);
  const rng = mulberry32(kind === 'base' ? 11 : 12);
  const fr = TRUE_RPM / 60;
  const bpfo = defectFactors().BPFO * fr;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = 0.22 * Math.sin(2 * Math.PI * 100 * t) + 0.07 * Math.sin(2 * Math.PI * 200 * t + 0.4)
      + 0.06 * Math.sin(2 * Math.PI * fr * t) + 0.04 * Math.sin(2 * Math.PI * 2 * fr * t + 1.1)
      + 0.05 * gauss(rng);
  }
  if (kind !== 'base') {
    let t = 0.01;
    const ring = Math.floor(SR * 0.004);
    while (t < dur - 0.01) {
      const i0 = Math.floor(t * SR);
      const a = 0.62 * (0.8 + 0.4 * rng());
      for (let j = 0; j < ring && i0 + j < n; j++) {
        const tt = j / SR;
        x[i0 + j] += a * Math.exp(-tt / 0.00055) * Math.sin(2 * Math.PI * 3200 * tt);
      }
      t += (1 / bpfo) * (1 + 0.012 * (rng() - 0.5));
    }
  }
  if (kind === 'env') {
    let hp = 0, prev = 0, lp = 0, mean = 0;
    const aH = 0.97, aL = 1 - Math.exp((-2 * Math.PI * 420) / SR);
    for (let i = 0; i < n; i++) { hp = aH * (hp + x[i] - prev); prev = x[i]; lp += aL * (Math.abs(hp) - lp); x[i] = lp; mean += lp; }
    mean /= n;
    for (let i = 0; i < n; i++) x[i] -= mean;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(x[i]));
  const g = 0.7 / peak, fade = Math.floor(SR * 0.03);
  for (let i = 0; i < n; i++) x[i] *= g * Math.min(1, i / fade, (n - 1 - i) / fade);
  return x;
}

let ctx: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;

export async function play(data: Float32Array, onEnd?: () => void) {
  ctx = ctx ?? new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  stop();
  const buf = new AudioBuffer({ length: data.length, numberOfChannels: 1, sampleRate: SR });
  buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.55;
  src.buffer = buf;
  src.connect(gain).connect(ctx.destination);
  src.onended = () => { if (playing === src) playing = null; onEnd?.(); };
  src.start();
  playing = src;
}

export function stop() {
  if (!playing) return;
  const p = playing;
  playing = null;
  try { p.stop(); } catch { /* already stopped */ }
}
