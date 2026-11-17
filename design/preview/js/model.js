// NAADI design preview: demo data and the physics behind it.
// Readings, people and prices are synthetic demo data. Every number the page
// shows is computed here: bearing defect frequencies from 6205 geometry,
// change-point detection, Monte Carlo time-to-failure, expected cost per
// repair window, and a Bayesian ranking of rulebook hypotheses.

export const CARD_H = 6; // hours per card
export const N_PAST = 56; // 14 days punched
export const N_AHEAD = 48; // 12 days of blank forecast cards
const HOUR = 3600e3;
export const NOW = Date.UTC(2026, 10, 17, 6, 30); // Tue 17 Nov 2026, 12:00 IST
export const cardStart = (k) => NOW - (N_PAST - k) * CARD_H * HOUR;

export const WATCH_AT = 0.08; // degradation index thresholds
export const ACT_AT = 0.16;
const BASE_P = 0.006; // per-channel false-hole rate the EVT threshold is tuned to

// ---------------------------------------------------------------- utilities
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
const pad = (n) => String(n).padStart(2, '0');
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function ist(ms) {
  const d = new Date(ms + 5.5 * HOUR);
  return { mo: d.getUTCMonth(), day: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}
export const weekday = (ms) => WD[ist(ms).wd];
export const monthName = (ms) => MO[ist(ms).mo];
export function cardLabel(k) {
  const a = ist(cardStart(k));
  const b = ist(cardStart(k + 1));
  return `${WD[a.wd]} ${a.day} ${MO[a.mo]}, ${pad(a.h)}:00–${b.h === 0 ? '24' : pad(b.h)}:00`;
}
export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export const pct = (p) => (p < 0.001 ? '<0.1%' : p < 0.01 ? (p * 100).toFixed(1) + '%' : Math.round(p * 100) + '%');

// ------------------------------------------------------------ the shed
export const CHANNELS = [
  { id: 'VEL', name: 'Velocity RMS', short: 'Velocity' },
  { id: 'KURT', name: 'Kurtosis', short: 'Kurtosis' },
  { id: 'ENV', name: 'Envelope at bearing tones', short: 'Envelope' },
  { id: '1X', name: '1× shaft amplitude', short: '1× shaft' },
  { id: '2X', name: '2× shaft amplitude', short: '2× shaft' },
  { id: 'SND', name: 'Sound (log-mel score)', short: 'Sound' },
  { id: 'AMP', name: 'Motor current', short: 'Current' },
  { id: 'TMP', name: 'Housing temperature', short: 'Temp' },
];

export const MACHINES = [
  { id: 'L01', kind: 'loom', name: 'Loom 01', tag: '01', pos: [-5.6, 0, 1.3] },
  { id: 'L02', kind: 'loom', name: 'Loom 02', tag: '02', pos: [-1.4, 0, 1.3] },
  { id: 'L03', kind: 'loom', name: 'Loom 03', tag: '03', pos: [2.8, 0, 1.3] },
  { id: 'L04', kind: 'loom', name: 'Loom 04', tag: '04', pos: [-5.6, 0, -2.6] },
  { id: 'L05', kind: 'loom', name: 'Loom 05', tag: '05', pos: [-1.4, 0, -2.6] },
  { id: 'L06', kind: 'loom', name: 'Loom 06', tag: '06', pos: [2.8, 0, -2.6] },
  { id: 'C01', kind: 'chakki', name: 'Chakki', tag: 'C1', pos: [7.9, 0, -2.5] },
  { id: 'P01', kind: 'pump', name: 'Pump 1', tag: 'P1', pos: [7.3, 0, 1.7] },
  { id: 'P02', kind: 'pump', name: 'Pump 2', tag: 'P2', pos: [9.4, 0, 1.7] },
];

// Fault profiles: onset t0 (days since card 0), degradation d = d0·e^{b(t−t0)},
// and per-channel punch probability [amplitude, centre card, width].
const PROFILES = {
  L03: {
    t0: 5.0, d0: 0.04, b: 0.19,
    label: 'Bearing outer-race defect',
    ch: { ENV: [0.95, 24, 3], KURT: [0.9, 30, 3], VEL: [0.9, 40, 3], SND: [0.85, 36, 3], TMP: [0.8, 47, 2.5], AMP: [0.2, 48, 3] },
  },
  P02: {
    t0: 8.0, d0: 0.05, b: 0.12,
    label: 'Cavitation onset',
    rule: 'PMP-CAV-01', p: 0.71,
    action: 'Check the suction strainer and foot valve this week.',
    ch: { SND: [0.8, 34, 3], AMP: [0.6, 40, 3], VEL: [0.3, 46, 3] },
  },
  L05: {
    t0: 10.0, d0: 0.05, b: 0.16,
    label: 'Belt wear or slip',
    rule: 'BLT-02', p: 0.64,
    action: 'Check belt tension at the next shift change.',
    ch: { '1X': [0.45, 42, 3], AMP: [0.35, 46, 3] },
  },
};

export function offReason(k) {
  const p = ist(cardStart(k));
  if (p.wd === 0) return 'Weekly off (Sunday)';
  if (p.mo === 10 && (p.day === 12 || p.day === 19) && p.h === 12)
    return 'Scheduled power cut 14:00–18:00 · card not scored (under 3 h running)';
  return null;
}
export const REPAIR_CARD = 64; // Thu 19 Nov, 12:00–18:00 card holds the 14:00–18:00 power cut

// Page-Hinkley change detection on log(d): returns the alarm card and the onset estimate.
function pageHinkley(cards, { delta = 0.05, lambda = 0.8 } = {}) {
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

// Least-squares fit of ln(d) against time after the onset: the growth rate b.
function fitGrowth(cards, fromK) {
  const pts = cards.filter((c) => !c.off && c.k >= fromK).map((c) => [c.t, Math.log(c.dS)]);
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); }
  const b = sxy / sxx;
  let sse = 0;
  for (const [x, y] of pts) sse += (y - (my + b * (x - mx))) ** 2;
  const se = Math.sqrt(sse / (n - 2) / sxx);
  return { b, se, n };
}

export function buildModel() {
  const rng = mulberry32(20261117);
  const machines = MACHINES.map((def) => {
    const prof = PROFILES[def.id] || null;
    const base = 0.012 + 0.012 * rng();
    const cards = [];
    let dS = base;
    for (let k = 0; k < N_PAST; k++) {
      const t = (k + 0.5) / 4;
      const off = offReason(k);
      let d = base * Math.exp(0.08 * gauss(rng));
      if (prof && t >= prof.t0) d = Math.max(d, prof.d0 * Math.exp(prof.b * (t - prof.t0)) * Math.exp(0.05 * gauss(rng)));
      if (!off) dS = 0.5 * d + 0.5 * dS;
      const state = off ? 'off' : dS >= ACT_AT ? 'act' : dS >= WATCH_AT ? 'watch' : 'normal';
      const holes = CHANNELS.map((ch) => {
        const s = prof && prof.ch[ch.id];
        const p = BASE_P + (s ? s[0] / (1 + Math.exp(-(k - s[1]) / s[2])) : 0);
        const hit = rng() < p;
        return !off && hit;
      });
      cards.push({ k, t, d, dS, state, off, holes, n: holes.filter(Boolean).length });
    }
    const live = [...cards].reverse().find((c) => !c.off);
    return { ...def, prof, cards, now: live };
  });

  const byId = Object.fromEntries(machines.map((m) => [m.id, m]));
  const loom = byId.L03;
  const ph = pageHinkley(loom.cards);
  const fit = fitGrowth(loom.cards, ph ? ph.onset : 20);
  const r = rul(loom.now.dS, { bMed: fit.b, bSigma: Math.hypot(fit.se / fit.b, 0.25) });
  return { machines, byId, ph, fit, rul: r, cost: costs(r), notes: NOTES };
}

export const NOTES = [
  {
    machine: 'L03', k: 55, time: '09:42', who: 'Sunita K.', role: 'weaver',
    mr: 'खट-खट आवाज येतोय', en: 'There is a knocking sound', lr: 1.8, rule: 'BRG-OR-01 · e3',
  },
];

// ------------------------------------------------------- time to failure
export function rul(dNow, { bMed, bSigma, dSd = 0.015, n = 2000, seed = 7 }) {
  const rr = mulberry32(seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const b = bMed * Math.exp(bSigma * gauss(rr));
    const d = Math.max(0.02, dNow + dSd * gauss(rr));
    out[i] = Math.log(1 / d) / b;
  }
  out.sort();
  const q = (p) => out[Math.min(n - 1, Math.max(0, Math.floor(p * n)))];
  const cdf = (t) => {
    let lo = 0, hi = n;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (out[mid] <= t) lo = mid + 1; else hi = mid; }
    return lo / n;
  };
  return { n, q, cdf, p10: q(0.1), p50: q(0.5), p90: q(0.9), bMed, bSigma, dNow };
}

// ------------------------------------------------------------ rupees
export const COST = {
  downtimeH: 16, marginH: 700, wagesH: 250, part: 380, premium: 0.6,
  callout: 1500, pSecondary: 0.2, secondary: 20000, labour: 900,
};
export function costs(r) {
  const perH = COST.marginH + COST.wagesH;
  const parts = {
    downtime: COST.downtimeH * perH,
    part: COST.part * (1 + COST.premium),
    callout: COST.callout,
    secondary: COST.pSecondary * COST.secondary,
  };
  const unplanned = parts.downtime + parts.part + parts.callout + parts.secondary;
  const planned = COST.part + COST.labour;
  const windows = [
    { id: 'now', when: 'Today, stop the loom now', note: '4 h of output lost', t: 0.02, lostH: 4 },
    { id: 'thu', when: 'Thu 19 Nov, 14:00–18:00', note: 'Scheduled power cut', t: 50 / 24, lostH: 0 },
    { id: 'sun', when: 'Sun 22 Nov, morning', note: 'Weekly off', t: 118 / 24, lostH: 0 },
    { id: 'rtf', when: 'Run to failure', note: 'Breakdown at an unplanned time', t: Infinity, lostH: 0 },
  ].map((w) => {
    const F = w.t === Infinity ? 1 : r.cdf(w.t);
    const plannedHere = planned + w.lostH * perH;
    return { ...w, F, E: F * unplanned + (1 - F) * plannedHere, plannedHere };
  });
  const best = windows.reduce((a, b) => (b.E < a.E ? b : a));
  return { perH, parts, unplanned, planned, windows, best, saving: unplanned - best.E };
}

// --------------------------------------------------------- bearing physics
export const BEARING = { name: '6205-2RS', n: 9, d: 7.94, D: 39.04, phi: 0, od: 52, bore: 25 };
export function defectFactors(b = BEARING) {
  const r = (b.d / b.D) * Math.cos(b.phi);
  return {
    FTF: 0.5 * (1 - r),
    BPFO: (b.n / 2) * (1 - r),
    BPFI: (b.n / 2) * (1 + r),
    BSF: (b.D / (2 * b.d)) * (1 - r * r),
    ratio: r,
  };
}
export const TRUE_RPM = 1436; // what the loom motor actually ran at during card 56

function floorDb(f) {
  return -64 + 7 * Math.exp(-f / 35) + 1.5 * Math.exp(-f / 250);
}

export function envelopeSpectrum({ seed = 3 } = {}) {
  const fr = TRUE_RPM / 60;
  const F = defectFactors();
  const df = 0.25, fmax = 400, n = Math.round(fmax / df) + 1;
  const f = new Float64Array(n), now = new Float64Array(n), base = new Float64Array(n);
  const rn = mulberry32(seed), rb = mulberry32(seed + 101);
  const sig = 0.45;
  const bpfo = F.BPFO * fr, ftf = F.FTF * fr;
  const peaksBase = [[fr, 5], [2 * fr, 2]];
  const peaksNow = [
    [fr, 6], [2 * fr, 2.5],
    [bpfo, 17.5], [2 * bpfo, 12.5], [3 * bpfo, 8], [4 * bpfo, 4.5],
    [bpfo - ftf, 3], [bpfo + ftf, 3],
  ];
  const lin = (db) => Math.pow(10, db / 10);
  for (let i = 0; i < n; i++) {
    const fi = i * df;
    f[i] = fi;
    const fl = floorDb(fi);
    let pb = lin(fl + 0.6 * gauss(rb));
    let pn = lin(fl + (fi > 150 ? 1.2 : 0) + 0.6 * gauss(rn));
    for (const [f0, A] of peaksBase) pb += lin(floorDb(f0) + A) * Math.exp(-0.5 * ((fi - f0) / sig) ** 2);
    for (const [f0, A] of peaksNow) pn += lin(floorDb(f0) + A) * Math.exp(-0.5 * ((fi - f0) / sig) ** 2);
    base[i] = 10 * Math.log10(pb);
    now[i] = 10 * Math.log10(pn);
  }
  return { f, now, base, df, fmax, fr };
}

const idx = (spec, hz) => Math.max(0, Math.min(spec.f.length - 1, Math.round(hz / spec.df)));
function peakNear(arr, spec, hz, halfHz = 0.75) {
  const a = idx(spec, hz - halfHz), b = idx(spec, hz + halfHz);
  let best = -Infinity, at = a;
  for (let i = a; i <= b; i++) if (arr[i] > best) { best = arr[i]; at = i; }
  return { db: best, hz: spec.f[at], i: at };
}
function localFloor(arr, spec, hz) {
  const vals = [];
  const a = idx(spec, hz - 6), b = idx(spec, hz + 6), x0 = idx(spec, hz - 1.5), x1 = idx(spec, hz + 1.5);
  for (let i = a; i <= b; i++) if (i < x0 || i > x1) vals.push(arr[i]);
  vals.sort((p, q) => p - q);
  return vals[Math.floor(vals.length / 2)];
}

// How strongly the BPFO family stands above the local floor at cursors placed for a given speed.
export function cursorFit(spec, rpm) {
  const F = defectFactors();
  const fr = rpm / 60;
  let sum = 0;
  for (let h = 1; h <= 3; h++) {
    const hz = h * F.BPFO * fr;
    sum += peakNear(spec.now, spec, hz).db - localFloor(spec.now, spec, hz);
  }
  return sum / 3;
}

// Shaft speed from the 1× peak, with parabolic interpolation between bins.
export function speedFrom1x(spec) {
  const a = idx(spec, 18), b = idx(spec, 30);
  let best = -Infinity, at = a;
  for (let i = a; i <= b; i++) if (spec.now[i] > best) { best = spec.now[i]; at = i; }
  const y0 = spec.now[at - 1], y1 = spec.now[at], y2 = spec.now[at + 1];
  const off = (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2);
  return (spec.f[at] + off * spec.df) * 60;
}

// The readable twin of the spectrum: every bearing tone at a given speed.
export function toneTable(spec, rpm) {
  const F = defectFactors();
  const fr = rpm / 60;
  const tones = [
    ['FTF (cage)', F.FTF], ['1× shaft', 1], ['BSF (ball spin)', F.BSF],
    ['BPFO', F.BPFO], ['2× BPFO', 2 * F.BPFO], ['3× BPFO', 3 * F.BPFO], ['BPFI', F.BPFI],
  ];
  return tones.map(([name, k]) => {
    const hz = k * fr;
    return {
      name, hz,
      now: peakNear(spec.now, spec, hz).db - localFloor(spec.now, spec, hz),
      base: peakNear(spec.base, spec, hz).db - localFloor(spec.base, spec, hz),
    };
  });
}

export function spectrumFacts(spec) {
  const F = defectFactors();
  const bpfo = F.BPFO * spec.fr, bpfi = F.BPFI * spec.fr;
  const pk = peakNear(spec.now, spec, bpfo);
  const overBase = pk.db - peakNear(spec.base, spec, bpfo).db;
  const bpfiExcess = peakNear(spec.now, spec, bpfi).db - localFloor(spec.now, spec, bpfi);
  const harmonics = [2, 3].filter((h) => {
    const hz = h * bpfo;
    return peakNear(spec.now, spec, hz).db - localFloor(spec.now, spec, hz) > 4;
  });
  return { bpfo, bpfi, peakHz: pk.hz, overBase, bpfiExcess, harmonics };
}

// ------------------------------------------------------------ diagnosis
export const HYPOTHESES = [
  { id: 'BRG-OR-01', name: 'Bearing outer-race defect', prior: 0.18, lr: { env: 8.0, kurt: 3.0, note: 1.8, temp: 1.4, x1: 1.0, bpfi: 1.2 } },
  { id: 'BRG-LUB-02', name: 'Lubrication starvation', prior: 0.14, lr: { env: 1.5, kurt: 1.8, note: 1.5, temp: 2.5, x1: 1.0, bpfi: 1.0 } },
  { id: 'LSN-01', name: 'Mechanical looseness', prior: 0.1, lr: { env: 0.7, kurt: 1.5, note: 1.6, temp: 1.0, x1: 0.7, bpfi: 1.0 } },
  { id: 'BRG-IR-01', name: 'Bearing inner-race defect', prior: 0.1, lr: { env: 0.6, kurt: 3.0, note: 1.8, temp: 1.4, x1: 1.0, bpfi: 0.2 } },
  { id: 'ALN-02', name: 'Belt or shaft misalignment', prior: 0.17, lr: { env: 0.4, kurt: 0.8, note: 1.2, temp: 1.3, x1: 0.5, bpfi: 1.0 } },
  { id: 'MTR-RB-01', name: 'Motor rotor bar', prior: 0.08, lr: { env: 0.3, kurt: 0.7, note: 0.6, temp: 1.3, x1: 1.0, bpfi: 1.0 } },
  { id: 'UNB-01', name: 'Unbalance', prior: 0.16, lr: { env: 0.3, kurt: 0.6, note: 0.8, temp: 1.0, x1: 0.2, bpfi: 1.0 } },
  { id: 'SNS-00', name: 'Sensor or mounting fault', prior: 0.07, lr: { env: 0.05, kurt: 0.3, note: 0.5, temp: 0.8, x1: 1.2, bpfi: 1.0 } },
];

export function evidence(spec) {
  const s = spectrumFacts(spec);
  return [
    { id: 'env', rule: 'BRG-OR-01 · e1', text: `Envelope peak at BPFO ${s.peakHz.toFixed(1)} Hz, ${s.overBase.toFixed(1)} dB over its baseline, with ${s.harmonics.map((h) => h + '×').join(' and ')} harmonics` },
    { id: 'kurt', rule: 'BRG-OR-01 · e2', text: 'Kurtosis 5.7 against a baseline of 3.1: the signal has turned impulsive' },
    { id: 'note', rule: 'BRG-OR-01 · e3', text: 'Sunita K. reported a knocking sound at 09:42' },
    { id: 'temp', rule: 'BRG-OR-01 · e4', text: 'Housing 6.1 °C above its load-matched baseline' },
    { id: 'bpfi', rule: 'BRG-IR-01 · e1', text: `No peak at BPFI ${s.bpfi.toFixed(1)} Hz (${s.bpfiExcess.toFixed(1)} dB, within noise)` },
    { id: 'x1', rule: 'UNB-01 · e1', text: '1× shaft amplitude unchanged since week one' },
  ];
}

export function posterior(ids) {
  const rows = HYPOTHESES.map((h) => ({ ...h, w: h.prior * ids.reduce((acc, e) => acc * (h.lr[e] ?? 1), 1) }));
  const z = rows.reduce((s, r) => s + r.w, 0);
  return rows.map((r) => ({ ...r, p: r.w / z })).sort((a, b) => b.p - a.p);
}
