// Bearing physics and the envelope spectrum of Loom 03's motor drive-end bearing.
import { gauss, mulberry32 } from './core';

export interface Bearing { name: string; n: number; d: number; D: number; phi: number; od: number; bore: number }
/** 6205-2RS: 9 balls of 7.94 mm on a 39.04 mm pitch circle, 52 mm OD, 25 mm bore. */
export const BEARING: Bearing = { name: '6205-2RS', n: 9, d: 7.94, D: 39.04, phi: 0, od: 52, bore: 25 };

/** Defect frequencies as multiples of shaft speed fr. */
export function defectFactors(b: Bearing = BEARING) {
  const r = (b.d / b.D) * Math.cos(b.phi);
  return {
    FTF: 0.5 * (1 - r), // cage
    BPFO: (b.n / 2) * (1 - r), // ball pass, outer race
    BPFI: (b.n / 2) * (1 + r), // ball pass, inner race
    BSF: (b.D / (2 * b.d)) * (1 - r * r), // ball spin
    ratio: r,
  };
}

/** What the loom motor actually ran at during card 56 (the 1× peak recovers it). */
export const TRUE_RPM = 1436;

export interface Spectrum { f: Float64Array; now: Float64Array; base: Float64Array; df: number; fmax: number; fr: number }

const floorDb = (f: number) => -64 + 7 * Math.exp(-f / 35) + 1.5 * Math.exp(-f / 250);
const lin = (db: number) => Math.pow(10, db / 10);

/** Envelope spectrum (0–400 Hz) of the drive-end accelerometer: a card vs the healthy first week.
 *  `severity` places the card on the wear path: 0 is this loom's own normal, 1 is card 56.
 *  Fault tones grow in power with severity² (amplitude ∝ severity), so card 56 is unchanged. */
export function envelopeSpectrum(seed = 3, severity = 1): Spectrum {
  const fr = TRUE_RPM / 60;
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
  const faultNow: [number, number][] = [
    [bpfo, 17.5], [2 * bpfo, 12.5], [3 * bpfo, 8], [4 * bpfo, 4.5],
    [bpfo - ftf, 3], [bpfo + ftf, 3],
  ];
  for (let i = 0; i < n; i++) {
    const fi = i * df;
    f[i] = fi;
    const fl = floorDb(fi);
    let pb = lin(fl + 0.6 * gauss(rb));
    let pn = lin(fl + (fi > 150 ? 1.2 * s : 0) + 0.6 * gauss(rn));
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

/** Mean height of the BPFO family above the local floor, at cursors placed for a given speed. */
export function cursorFit(s: Spectrum, rpm: number): number {
  const F = defectFactors();
  const fr = rpm / 60;
  let sum = 0;
  for (let h = 1; h <= 3; h++) {
    const hz = h * F.BPFO * fr;
    sum += peakNear(s.now, s, hz).db - localFloor(s.now, s, hz);
  }
  return sum / 3;
}

/** Shaft speed from the 1× peak, with parabolic interpolation between bins. */
export function speedFrom1x(s: Spectrum): number {
  const a = idx(s, 18), b = idx(s, 30);
  let best = -Infinity, at = a;
  for (let i = a; i <= b; i++) if (s.now[i] > best) { best = s.now[i]; at = i; }
  const y0 = s.now[at - 1], y1 = s.now[at], y2 = s.now[at + 1];
  const off = (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2);
  return (s.f[at] + off * s.df) * 60;
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
