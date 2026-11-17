// The demo shed: nine machines, fourteen days of six-hour cards, eight channels per card.
// Faulty machines follow an exponential degradation law; every card's holes are drawn
// from per-channel probabilities that rise as the fault develops.
import { ACT_AT, N_PAST, WATCH_AT, cardStart, gauss, ist, mulberry32, type State } from './core';
import { DEFAULT_SETUP, FAULTS, FLOOR, WEAR, activeSetup, type Setup } from './setup';
import { rul, type Rul } from './decide';

export interface Channel { id: string; name: string; short: string }
export const CHANNELS: Channel[] = [
  { id: 'VEL', name: 'Velocity RMS', short: 'Velocity' },
  { id: 'KURT', name: 'Kurtosis', short: 'Kurtosis' },
  { id: 'ENV', name: 'Envelope at bearing tones', short: 'Envelope' },
  { id: '1X', name: '1× shaft amplitude', short: '1× shaft' },
  { id: '2X', name: '2× shaft amplitude', short: '2× shaft' },
  { id: 'SND', name: 'Sound (log-mel score)', short: 'Sound' },
  { id: 'AMP', name: 'Motor current', short: 'Current' },
  { id: 'TMP', name: 'Housing temperature', short: 'Temp' },
];

export type Kind = 'loom' | 'chakki' | 'pump';
export interface MachineDef { id: string; kind: Kind; name: string; tag: string; pos: [number, number, number]; nameplate: string }
export const MACHINES: MachineDef[] = [
  { id: 'L01', kind: 'loom', name: 'Loom 01', tag: '01', pos: [-5.6, 0, 1.3], nameplate: 'Shuttle loom, 2 hp motor, 1440 rpm' },
  { id: 'L02', kind: 'loom', name: 'Loom 02', tag: '02', pos: [-1.4, 0, 1.3], nameplate: 'Shuttle loom, 2 hp motor, 1440 rpm' },
  { id: 'L03', kind: 'loom', name: 'Loom 03', tag: '03', pos: [2.8, 0, 1.3], nameplate: 'Shuttle loom, 2 hp motor, 1440 rpm, DE bearing 6205-2RS' },
  { id: 'L04', kind: 'loom', name: 'Loom 04', tag: '04', pos: [-5.6, 0, -2.6], nameplate: 'Shuttle loom, 2 hp motor, 1440 rpm' },
  { id: 'L05', kind: 'loom', name: 'Loom 05', tag: '05', pos: [-1.4, 0, -2.6], nameplate: 'Shuttle loom, 2 hp motor, V-belt drive' },
  { id: 'L06', kind: 'loom', name: 'Loom 06', tag: '06', pos: [2.8, 0, -2.6], nameplate: 'Shuttle loom, 2 hp motor, 1440 rpm' },
  { id: 'C01', kind: 'chakki', name: 'Chakki', tag: 'C1', pos: [7.9, 0, -2.5], nameplate: 'Stone flour mill, 7.5 hp motor, flat belt' },
  { id: 'P01', kind: 'pump', name: 'Pump 1', tag: 'P1', pos: [7.3, 0, 1.7], nameplate: 'Monoblock pump set, 3 hp' },
  { id: 'P02', kind: 'pump', name: 'Pump 2', tag: 'P2', pos: [9.4, 0, 1.7], nameplate: 'Monoblock pump set, 3 hp, borewell suction' },
];

export interface Profile {
  t0: number; d0: number; b: number;
  /** curvature of ln d per day² (wear that speeds up); 0 for steady exponential wear */
  a?: number;
  label: string; rule: string; p?: number; action: string;
  ch: Record<string, [number, number, number]>; // [amplitude, centre card, width]
}
// Fault profiles: onset t0 (days since card 0), degradation d = d0·e^{b(t−t0) + a(t−t0)²}.
// Loom 03's fault, wear rate and curvature come from the active setup (setup.ts).
export function loomProfile(setup: Setup = activeSetup()): Profile {
  const f = FAULTS[setup.fault], w = WEAR[setup.wear];
  // another fortnight draws its own onset and wear rate around the chosen ones; the demo's seed keeps day 5
  const r = setup.seed === DEFAULT_SETUP.seed ? null : mulberry32(setup.seed ^ 0x5bd1e995);
  const t0 = r ? 3.5 + 3 * r() : 5.0;
  const b = r ? w.b * (0.85 + 0.3 * r()) : w.b;
  // the channel signature shifts with the onset, so holes arrive when the wear does
  const shift = Math.round((t0 - 5.0) * 4);
  const ch = Object.fromEntries(Object.entries(f.ch).map(([k, [amp, c, wd]]) => [k, [amp, c + shift, wd]])) as Profile['ch'];
  return { t0, d0: 0.04, b, a: w.a, label: f.label, rule: f.rule, action: f.action, ch };
}
const OTHER: Record<string, Profile> = {
  P02: {
    t0: 8.0, d0: 0.05, b: 0.12,
    label: 'Cavitation onset', rule: 'PMP-CAV-01', p: 0.71,
    action: 'Check the suction strainer and foot valve this week.',
    ch: { SND: [0.8, 34, 3], AMP: [0.6, 40, 3], VEL: [0.3, 46, 3] },
  },
  L05: {
    t0: 10.0, d0: 0.05, b: 0.16,
    label: 'Belt wear or slip', rule: 'BLT-02', p: 0.64,
    action: 'Check belt tension at the next shift change.',
    ch: { '1X': [0.45, 42, 3], AMP: [0.35, 46, 3] },
  },
};
export const profileOf = (id: string): Profile | null => (id === 'L03' ? loomProfile() : OTHER[id] ?? null);

export function offReason(k: number): string | null {
  const p = ist(cardStart(k));
  if (p.wd === 0) return 'Weekly off (Sunday)';
  const power = activeSetup().power;
  if (power === 'scheduled' && p.mo === 10 && (p.day === 12 || p.day === 19) && p.h === 12)
    return 'Scheduled power cut 14:00–18:00 · card not scored (under 3 h running)';
  if (power === 'unscheduled' && k < N_PAST && unscheduledCut(k)) return 'Unscheduled power cut · card not scored (under 3 h running)';
  return null;
}
/** Unscheduled cuts: about one working card in fourteen, drawn from the setup's seed. */
function unscheduledCut(k: number) {
  return mulberry32((activeSetup().seed ^ Math.imul(k + 1, 2654435761)) >>> 0)() < 0.07;
}
/** Thu 19 Nov, 12:00–18:00: the card that holds the 14:00–18:00 power cut. */
export const REPAIR_CARD = 64;

export interface Card { k: number; t: number; d: number; dS: number; state: State; off: boolean; holes: boolean[]; n: number }
export interface PageHinkley { alarm: number; onset: number }
export interface Growth { b: number; se: number; n: number }
export interface Machine extends MachineDef {
  prof: Profile | null;
  cards: Card[];
  now: Card;
  ph: PageHinkley | null;
  /** first card of the growth fit (see fitStart) */
  fitFrom: number | null;
  fit: Growth | null;
  rul: Rul | null;
}

/** Page-Hinkley change detection on log(d): the alarm card and the onset estimate. */
export function pageHinkley(cards: Card[], { delta = 0.05, lambda = 0.8 } = {}): PageHinkley | null {
  let mean = 0, n = 0, m = 0, M = 0, argM = 0;
  for (const c of cards) {
    if (c.off) continue;
    const x = Math.log(c.dS);
    n += 1;
    mean += (x - mean) / n;
    m += x - mean - delta;
    if (m < M) { M = m; argM = c.k; }
    if (n > 8 && m - M > lambda) return { alarm: c.k, onset: argM };
  }
  return null;
}

/** Least-squares slope of ln(d) against time after the onset: the growth rate b, with its standard error. */
export function fitGrowth(cards: Card[], fromK: number): Growth {
  const pts = cards.filter((c) => !c.off && c.k >= fromK).map((c) => [c.t, Math.log(c.dS)] as const);
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); }
  const b = sxy / sxx;
  let sse = 0;
  for (const [x, y] of pts) sse += (y - (my + b * (x - mx))) ** 2;
  return { b, se: Math.sqrt(sse / (n - 2) / sxx), n };
}

/** How the forecast is made, as tuned by the simulation study on /model (docs/11). */
export const FORECAST = {
  /** scored cards skipped after the wear clears the normal band, for the smoothing to settle */
  settle: 2,
  /** the normal band: mean + 3 sd of log degradation on the scored cards before the onset */
  band: 3,
  /** smoothing makes neighbouring cards correlated (ρ ≈ 0.5), so the fit has a third of the
   *  points it appears to: the least-squares error is scaled by √((1 + ρ)/(1 − ρ)) = √3 */
  seInflate: Math.sqrt(3),
  /** model-form prior on how wear accelerates, on top of the fit's own error */
  prior: 0.15,
  /** curvature is used only when its t-statistic (on the inflated error) clears this */
  curveZ: 2,
  /** and only with at least this many cards in the fit */
  curveMin: 8,
};

/** A quadratic in ln d, centred on the last card: slope b and curvature a there, with errors. */
export interface Curve { b: number; seB: number; a: number; seA: number; z: number }
export function fitCurve(cards: Card[], fromK: number): Curve | null {
  const pts = cards.filter((c) => !c.off && c.k >= fromK).map((c) => [c.t, Math.log(c.dS)] as const);
  const n = pts.length;
  if (n < 6) return null;
  const tl = pts[n - 1][0];
  // normal equations for y = c0 + c1·x + c2·x², x = t − t_last
  const S = [0, 0, 0, 0, 0], Y = [0, 0, 0];
  for (const [t, y] of pts) { const x = t - tl; let p = 1; for (let j = 0; j < 5; j++) { S[j] += p; if (j < 3) Y[j] += p * y; p *= x; } }
  const M = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
  const inv = invert3(M);
  if (!inv) return null;
  const c = [0, 1, 2].map((i) => inv[i][0] * Y[0] + inv[i][1] * Y[1] + inv[i][2] * Y[2]);
  let sse = 0;
  for (const [t, y] of pts) { const x = t - tl; sse += (y - (c[0] + c[1] * x + c[2] * x * x)) ** 2; }
  const s2 = sse / (n - 3);
  const seB = Math.sqrt(s2 * inv[1][1]), seA = Math.sqrt(s2 * inv[2][2]);
  return { b: c[1], seB, a: c[2], seA, z: c[2] / (FORECAST.seInflate * seA) };
}
function invert3(m: number[][]): number[][] | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

/** First card of the wear regime. Fitting from the change point itself would include the jump
 *  out of normal and make early forecasts too pessimistic. */
export function fitStart(cards: Card[], onset: number): number | null {
  const scored = cards.filter((c) => !c.off);
  let pre = scored.filter((c) => c.k < onset).map((c) => Math.log(c.dS));
  if (pre.length < 4) pre = scored.slice(0, 4).map((c) => Math.log(c.dS));
  const mu = pre.reduce((s, x) => s + x, 0) / pre.length;
  const sd = Math.max(0.05, Math.sqrt(pre.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, pre.length - 1)));
  const i = scored.findIndex((c) => c.k >= onset && Math.log(c.dS) > mu + FORECAST.band * sd);
  if (i < 0) return null;
  return scored[Math.min(scored.length - 1, i + FORECAST.settle)].k;
}

export interface Forecast { start: number; fit: Growth; rul: Rul; /** the curvature fit, when it was significant and used */ curve: Curve | null }
/** Growth fit from the wear regime, then Monte Carlo time to failure from the last scored card. */
export function forecast(cards: Card[], ph: PageHinkley, { n = 2000, seed = 7, prior = FORECAST.prior, curvature = true } = {}): Forecast | null {
  const start = fitStart(cards, ph.onset);
  if (start === null) return null;
  const scored = cards.filter((c) => !c.off);
  if (scored.filter((c) => c.k >= start).length < 4) return null;
  const fit = fitGrowth(cards, start);
  if (!(fit.b > 0.02)) return null;
  const dNow = scored[scored.length - 1].dS;
  // wear that is speeding up: use the slope and curvature at the last card, if the data insist
  const inFit = scored.filter((c) => c.k >= start).length;
  const cv = curvature && inFit >= FORECAST.curveMin ? fitCurve(cards, start) : null;
  if (cv && cv.a > 0 && cv.z > FORECAST.curveZ && cv.b > 0.02) {
    const r = rul(dNow, { bMed: cv.b, bSigma: Math.hypot((FORECAST.seInflate * cv.seB) / cv.b, prior), aMed: cv.a, aSd: FORECAST.seInflate * cv.seA, n, seed });
    return { start, fit, rul: r, curve: cv };
  }
  const r = rul(dNow, { bMed: fit.b, bSigma: Math.hypot((FORECAST.seInflate * fit.se) / fit.b, prior), n, seed });
  return { start, fit, rul: r, curve: null };
}

export function buildShed(setup: Setup = activeSetup()): Machine[] {
  const rng = mulberry32(setup.seed);
  const floor = FLOOR[setup.floor];
  return MACHINES.map((def) => {
    const prof = def.id === 'L03' ? loomProfile(setup) : OTHER[def.id] ?? null;
    const base = 0.012 + 0.012 * rng();
    const cards: Card[] = [];
    let dS = base;
    for (let k = 0; k < N_PAST; k++) {
      const t = (k + 0.5) / 4;
      const off = offReason(k) !== null;
      let d = base * Math.exp(floor.noise * gauss(rng));
      if (prof && t >= prof.t0) d = Math.max(d, prof.d0 * Math.exp(prof.b * (t - prof.t0) + (prof.a ?? 0) * (t - prof.t0) ** 2) * Math.exp(0.05 * gauss(rng)));
      if (!off) dS = 0.5 * d + 0.5 * dS;
      const state: State = off ? 'off' : dS >= ACT_AT ? 'act' : dS >= WATCH_AT ? 'watch' : 'normal';
      const holes = CHANNELS.map((ch) => {
        const s = prof?.ch[ch.id];
        const p = floor.falseHole + (s ? s[0] / (1 + Math.exp(-(k - s[1]) / s[2])) : 0);
        const hit = rng() < p;
        return !off && hit;
      });
      cards.push({ k, t, d, dS, state, off, holes, n: holes.filter(Boolean).length });
    }
    const now = [...cards].reverse().find((c) => !c.off)!;
    const ph = prof ? pageHinkley(cards) : null;
    const fc = ph ? forecast(cards, ph) : null;
    return { ...def, prof, cards, now, ph, fitFrom: fc?.start ?? null, fit: fc?.fit ?? null, rul: fc?.rul ?? null };
  });
}

/** Holes on card k split into steady (seen in the last three scored cards) and isolated (the false-hole rate at work). */
export function splitHoles(m: Machine, k: number) {
  const prev = m.cards.slice(0, k).filter((x) => !x.off).slice(-3);
  const c = m.cards[k];
  const steady: string[] = [], isolated: string[] = [];
  CHANNELS.forEach((ch, i) => {
    if (!c.holes[i]) return;
    (prev.some((p) => p.holes[i]) ? steady : isolated).push(ch.short);
  });
  return { steady, isolated };
}

export const stateAt = (m: Machine, k: number): State => {
  const c = m.cards[k];
  if (!c.off) return c.state;
  return [...m.cards.slice(0, k + 1)].reverse().find((x) => !x.off)?.state ?? 'normal';
};
