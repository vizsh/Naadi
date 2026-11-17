// Bearing physics and the envelope spectrum of the hero machine's motor drive-end bearing.
// The bearing and the motor's speed come from the active shed (sheds.ts).
import { gauss, mulberry32 } from './core';
import { activeBearing, activeShed, type Family } from './setup';

export interface Bearing { name: string; n: number; d: number; D: number; phi: number; od: number; bore: number }
/** The powerloom's 6205-2RS: 9 balls of 7.94 mm on a 39.04 mm pitch circle, 52 mm OD, 25 mm bore.
 *  The study on /model always uses it; everything else reads the active shed's bearing. */
export const BEARING: Bearing = { name: '6205-2RS', n: 9, d: 7.94, D: 39.04, phi: 0, od: 52, bore: 25 };

/** Defect frequencies as multiples of shaft speed fr. */
export function defectFactors(b: Bearing = activeBearing()) {
  const r = (b.d / b.D) * Math.cos(b.phi);
  return {
    FTF: 0.5 * (1 - r), // cage
    BPFO: (b.n / 2) * (1 - r), // ball pass, outer race
    BPFI: (b.n / 2) * (1 + r), // ball pass, inner race
    BSF: (b.D / (2 * b.d)) * (1 - r * r), // ball spin
    ratio: r,
  };
}

/** What the hero's motor actually ran at during card 56 (the 1× peak recovers it). */
export const trueRpm = () => activeShed().rpm;

export interface Spectrum { f: Float64Array; now: Float64Array; base: Float64Array; df: number; fmax: number; fr: number }

const floorDb = (f: number) => -64 + 7 * Math.exp(-f / 35) + 1.5 * Math.exp(-f / 250);
const lin = (db: number) => Math.pow(10, db / 10);

/** Envelope spectrum (0–400 Hz) of the drive-end accelerometer: a card vs the healthy first week.
 *  `severity` places the card on the wear path: 0 is this loom's own normal, 1 is card 56.
 *  Fault tones grow in power with severity² (amplitude ∝ severity), so card 56 is unchanged. */
export function envelopeSpectrum(seed = 3, severity = 1, family: Family = 'bpfo'): Spectrum {
  const fr = trueRpm() / 60;
  const F = defectFactors();
  const df = 0.25, fmax = 400, n = Math.round(fmax / df) + 1;
  const f = new Float64Array(n), now = new Float64Array(n), base = new Float64Array(n);
  const rn = mulberry32(seed), rb = mulberry32(104);
  const sig = 0.45;
  const s = Math.max(0, severity), s2 = s * s;
  const bpfo = F.BPFO * fr, ftf = F.FTF * fr;
  const peaksBase: [number, number][] = [[fr, 5], [2 * fr, 2]];
  // shaft tones drift a little with wear; the outer-race family appears from nothing
  const shaftNow: [number, number][] = [[fr, 5 + s], [2 * fr, 2 + 0.5 * s]];
  const bpfi = F.BPFI * fr;
  // each fault's signature at card 56 strength, in dB above the floor
  const SIGNATURE: Record<Family, [number, number][]> = {
    bpfo: [[bpfo, 17.5], [2 * bpfo, 12.5], [3 * bpfo, 8], [4 * bpfo, 4.5], [bpfo - ftf, 3], [bpfo + ftf, 3]],
    bpfi: [[bpfi, 15], [2 * bpfi, 9], [bpfi - fr, 8], [bpfi + fr, 8], [2 * bpfi - fr, 4.5], [2 * bpfi + fr, 4.5]],
    shaft1: [[fr, 17], [2 * fr, 4]],
    shaft2: [[2 * fr, 15], [fr, 7], [3 * fr, 5]],
    broadband: [[fr, 1.5]],
    harmonics: [1, 2, 3, 4, 5, 6, 7].map((h) => [h * fr, 12 - h * 1.2] as [number, number]).concat([[0.5 * fr, 4], [1.5 * fr, 3.5]]),
  };
  const faultNow = SIGNATURE[family];
  const hiss = family === 'broadband' ? 7 : 1.2;
  for (let i = 0; i < n; i++) {
    const fi = i * df;
    f[i] = fi;
    const fl = floorDb(fi);
    let pb = lin(fl + 0.6 * gauss(rb));
    let pn = lin(fl + (fi > 150 ? hiss * s : family === 'broadband' && fi > 60 ? hiss * s * ((fi - 60) / 90) : 0) + 0.6 * gauss(rn));
    for (const [f0, A] of peaksBase) pb += lin(floorDb(f0) + A) * Math.exp(-0.5 * ((fi - f0) / sig) ** 2);
    for (const [f0, A] of shaftNow) pn += lin(floorDb(f0) + A) * Math.exp(-0.5 * ((fi - f0) / sig) ** 2);
    if (s2 > 0) for (const [f0, A] of faultNow) pn += s2 * lin(floorDb(f0) + A) * Math.exp(-0.5 * ((fi - f0) / sig) ** 2);
    base[i] = 10 * Math.log10(pb);
    now[i] = 10 * Math.log10(pn);
  }
  return { f, now, base, df, fmax, fr };
}

const idx = (s: Spectrum, hz: number) => Math.max(0, Math.min(s.f.length - 1, Math.round(hz / s.df)));
function peakNear(arr: Float64Array, s: Spectrum, hz: number, halfHz = 0.75) {
  const a = idx(s, hz - halfHz), b = idx(s, hz + halfHz);
  let best = -Infinity, at = a;
  for (let i = a; i <= b; i++) if (arr[i] > best) { best = arr[i]; at = i; }
  return { db: best, hz: s.f[at], i: at };
}
function localFloor(arr: Float64Array, s: Spectrum, hz: number) {
  const vals: number[] = [];
  const a = idx(s, hz - 6), b = idx(s, hz + 6), x0 = idx(s, hz - 1.5), x1 = idx(s, hz + 1.5);
  for (let i = a; i <= b; i++) if (i < x0 || i > x1) vals.push(arr[i]);
  vals.sort((p, q) => p - q);
  return vals[Math.floor(vals.length / 2)];
}

/** The tones a fault's signature sits on, as multiples of shaft speed, with their labels. */
export function familyTones(family: Family): { k: number; label: string }[] {
  const F = defectFactors();
  if (family === 'bpfi') return [{ k: F.BPFI, label: 'BPFI' }, { k: F.BPFI - 1, label: '−1×' }, { k: F.BPFI + 1, label: '+1×' }, { k: 2 * F.BPFI, label: '2×' }];
  if (family === 'shaft1' || family === 'shaft2' || family === 'harmonics') return [1, 2, 3, 4, 5].map((h) => ({ k: h, label: `${h}×` }));
  if (family === 'broadband') return [];
  return [1, 2, 3, 4].map((h) => ({ k: h * F.BPFO, label: h === 1 ? 'BPFO' : `${h}×` }));
}
export const FAMILY_NAME: Record<Family, string> = { bpfo: 'the BPFO family', bpfi: 'BPFI and its sidebands', shaft1: 'the shaft tones', shaft2: 'the shaft tones', broadband: 'the high band', harmonics: 'the shaft harmonics' };

/** Mean height of a fault's tones above the local floor, at cursors placed for a given speed. */
export function cursorFit(s: Spectrum, rpm: number, family: Family = 'bpfo'): number {
  const fr = rpm / 60;
  const tones = family === 'bpfo' ? familyTones('bpfo').slice(0, 3) : family === 'shaft1' ? familyTones(family).slice(0, 1) : family === 'shaft2' ? familyTones(family).slice(1, 2) : familyTones(family).slice(0, 3);
  if (!tones.length) return bandRise(s, 150, 390);
  let sum = 0;
  for (const t of tones) {
    const hz = t.k * fr;
    sum += peakNear(s.now, s, hz).db - localFloor(s.now, s, hz);
  }
  return sum / tones.length;
}

/** Shaft speed from the 1× peak, with parabolic interpolation between bins. */
export function speedFrom1x(s: Spectrum): number {
  const a = idx(s, s.fr * 0.8), b = idx(s, s.fr * 1.2);
  let best = -Infinity, at = a;
  for (let i = a; i <= b; i++) if (s.now[i] > best) { best = s.now[i]; at = i; }
  const y0 = s.now[at - 1], y1 = s.now[at], y2 = s.now[at + 1];
  const off = (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2);
  return (s.f[at] + off * s.df) * 60;
}

/** The healthy baseline's height above its own floor at a frequency, in dB. */
export function baseHeightAt(s: Spectrum, hz: number): number {
  return peakNear(s.base, s, hz).db - localFloor(s.base, s, hz);
}
/** Mean rise of the card's trace over the baseline between two frequencies, in dB. */
export function bandRise(s: Spectrum, lo: number, hi: number): number {
  let sum = 0, n = 0;
  for (let i = idx(s, lo); i <= idx(s, hi); i++) { sum += s.now[i] - s.base[i]; n++; }
  return sum / Math.max(1, n);
}
/** The numbers the diagnostician reads off one spectrum. */
export function readSpectrum(s: Spectrum) {
  const F = defectFactors(), fr = s.fr;
  const bpfi = F.BPFI * fr;
  return {
    bpfo: heightAt(s, F.BPFO * fr), bpfi: heightAt(s, bpfi), bpfiSide: (heightAt(s, bpfi - fr) + heightAt(s, bpfi + fr)) / 2,
    x1: heightAt(s, fr), x1base: baseHeightAt(s, fr), x2: heightAt(s, 2 * fr), x2base: baseHeightAt(s, 2 * fr),
    hf: bandRise(s, 150, 390), harmonics: [3, 4, 5, 6, 7].filter((h) => heightAt(s, h * fr) > 4).length + 2 * Number(heightAt(s, fr) > 4 && heightAt(s, 2 * fr) > 4),
    fr, bpfiHz: bpfi,
  };
}

/** How far the card's trace stands above its local floor at a frequency, in dB. */
export function heightAt(s: Spectrum, hz: number): number {
  return peakNear(s.now, s, hz).db - localFloor(s.now, s, hz);
}

/** The readable twin of the spectrum: every bearing tone at a given speed. */
export function toneTable(s: Spectrum, rpm: number) {
  const F = defectFactors();
  const fr = rpm / 60;
  const tones: [string, number][] = [
    ['FTF (cage)', F.FTF], ['1× shaft', 1], ['BSF (ball spin)', F.BSF],
    ['BPFO', F.BPFO], ['2× BPFO', 2 * F.BPFO], ['3× BPFO', 3 * F.BPFO], ['BPFI', F.BPFI],
  ];
  return tones.map(([name, k]) => {
    const hz = k * fr;
    return {
      name, hz,
      now: peakNear(s.now, s, hz).db - localFloor(s.now, s, hz),
      base: peakNear(s.base, s, hz).db - localFloor(s.base, s, hz),
    };
  });
}

export function spectrumFacts(s: Spectrum) {
  const F = defectFactors();
  const bpfo = F.BPFO * s.fr, bpfi = F.BPFI * s.fr;
  const pk = peakNear(s.now, s, bpfo);
  const overBase = pk.db - peakNear(s.base, s, bpfo).db;
  const bpfiExcess = peakNear(s.now, s, bpfi).db - localFloor(s.now, s, bpfi);
  const harmonics = [2, 3].filter((h) => peakNear(s.now, s, h * bpfo).db - localFloor(s.now, s, h * bpfo) > 4);
  return { bpfo, bpfi, peakHz: pk.hz, peakDb: pk.db, overBase, bpfiExcess, harmonics };
}
