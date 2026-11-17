// "Hear what NAADI hears": physically modelled sound of the hero machine's motor, for the
// active fault. Healthy = 100 Hz magnetic hum + shaft harmonics + broadband noise. Now adds the
// fault: an impact at every ball pass over an outer-race spall (BPFO) or an inner-race spall
// (BPFI, louder as it turns through the load zone), each ringing the housing near 3.2 kHz; a
// heavy 1× rumble for unbalance; 2× beating against 1× for misalignment; a hiss of balls rubbing
// for starved grease; a rattle at shaft rate with half-orders for looseness. Demodulated = what
// envelope analysis extracts: the fault on its own.
import { gauss, mulberry32 } from '@/lib/model/core';
import { defectFactors, trueRpm } from '@/lib/model/physics';
import { activeFault, activeSetup, type Family } from '@/lib/model/setup';

export type SoundKind = 'base' | 'now' | 'env';
const SR = 44100;

/** One line on what the "Now" sound is, for the active fault. */
export function soundNote(family: Family = activeFault().family): string {
  const fr = (trueRpm() / 60).toFixed(1);
  const head = `Synthesised from the model: 100 Hz magnetic hum and the shaft at ${fr} Hz`;
  const what: Record<Family, string> = {
    bpfo: `, with an impact at every ball pass over the outer-race spall (${(defectFactors().BPFO * trueRpm() / 60).toFixed(1)} Hz) ringing the housing near 3.2 kHz`,
    bpfi: `, with an impact at every ball pass over the inner-race spall (${(defectFactors().BPFI * trueRpm() / 60).toFixed(1)} Hz), louder each time it turns through the load zone`,
    shaft1: ', with the heavy spot pulling the shaft round once a turn: a deeper rumble at 1×',
    shaft2: ', with the misaligned shafts flexing twice a turn: 2× beating against 1×',
    broadband: ', with the balls rubbing instead of rolling: a dry hiss above 2 kHz and no single tone',
    harmonics: ', with the loose mount knocking against its bolts once a turn, and every other turn',
  };
  return `${head}${what[family]}. Real recordings replace this in the field build.`;
}

function ringAt(x: Float32Array, i0: number, a: number, hz = 3200, decay = 0.00055) {
  const ring = Math.floor(SR * decay * 8);
  for (let j = 0; j < ring && i0 + j < x.length; j++) { const tt = j / SR; x[i0 + j] += a * Math.exp(-tt / decay) * Math.sin(2 * Math.PI * hz * tt); }
}

export function synth(kind: SoundKind, dur = 3.2, family: Family = activeFault().family): Float32Array {
  const n = Math.floor(dur * SR);
  const x = new Float32Array(n);
  const rng = mulberry32(kind === 'base' ? 11 : 12);
  const fr = trueRpm() / 60;
  const F = defectFactors();
  // a healthy fortnight has nothing to add: "now" sounds like the first week
  const faulty = kind !== 'base' && activeSetup().fault !== 'none';
  const x1 = faulty && family === 'shaft1' ? 0.34 : faulty && family === 'harmonics' ? 0.1 : 0.06;
  const x2 = faulty && family === 'shaft2' ? 0.26 : 0.04;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = 0.22 * Math.sin(2 * Math.PI * 100 * t) + 0.07 * Math.sin(2 * Math.PI * 200 * t + 0.4)
      + x1 * Math.sin(2 * Math.PI * fr * t) + x2 * Math.sin(2 * Math.PI * 2 * fr * t + 1.1)
      + 0.05 * gauss(rng);
  }
  if (faulty) {
    if (family === 'bpfo' || family === 'bpfi') {
      const rate = (family === 'bpfo' ? F.BPFO : F.BPFI) * fr;
      let t = 0.01;
      while (t < dur - 0.01) {
        // an inner-race spall turns with the shaft: loud in the load zone, quiet away from it
        const zone = family === 'bpfi' ? 0.25 + 0.75 * Math.max(0, Math.cos(2 * Math.PI * fr * t)) : 1;
        ringAt(x, Math.floor(t * SR), 0.62 * zone * (0.8 + 0.4 * rng()));
        t += (1 / rate) * (1 + 0.012 * (rng() - 0.5));
      }
    } else if (family === 'broadband') {
      // rubbing: high-passed noise, flickering a little with the shaft
      let prev = 0, hp = 0;
      for (let i = 0; i < n; i++) {
        const w = gauss(rng);
        hp = 0.82 * (hp + w - prev); prev = w;
        x[i] += 0.16 * hp * (0.85 + 0.15 * Math.sin(2 * Math.PI * fr * (i / SR)));
      }
    } else if (family === 'harmonics') {
      // knocks once a turn, a softer one every other turn, ringing the base low and long
      let k = 0;
      for (let t = 0.02; t < dur - 0.02; t += 1 / fr, k++) {
        ringAt(x, Math.floor((t + 0.002 * gauss(rng)) * SR), 0.5 * (0.8 + 0.4 * rng()), 900, 0.0022);
        if (k % 2 === 0) ringAt(x, Math.floor((t + 0.5 / fr) * SR), 0.22, 700, 0.002);
      }
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

export async function play(data: Float32Array, onEnd?: () => void, sampleRate = SR) {
  ctx = ctx ?? new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  stop();
  const buf = new AudioBuffer({ length: data.length, numberOfChannels: 1, sampleRate });
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
