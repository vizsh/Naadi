// Time to failure, rupees, and the Bayesian ranking of causes.
import { gauss, mulberry32 } from './core';
import { activeFault, activeOrders, activeSetup, activeShed, heroId } from './setup';
import { defectFactors, readSpectrum, spectrumFacts, type Spectrum } from './physics';

// ---------------------------------------------------------------- time to failure
export interface Rul {
  n: number; p10: number; p50: number; p90: number;
  bMed: number; bSigma: number; dNow: number;
  /** curvature of ln d per day² when the forecast uses it, else 0 */
  aMed: number;
  q: (p: number) => number; cdf: (t: number) => number;
}

/** Monte Carlo time to failure: d(t) = d_now·e^{b·t + a·t²} reaches 1, with b log-normal around the
 *  fit and, when the forecast found significant curvature, a normal around its estimate (a ≥ 0). */
export function rul(dNow: number, { bMed, bSigma, aMed = 0, aSd = 0, dSd = 0.015, n = 2000, seed = 7 }: { bMed: number; bSigma: number; aMed?: number; aSd?: number; dSd?: number; n?: number; seed?: number }): Rul {
  const rr = mulberry32(seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const b = bMed * Math.exp(bSigma * gauss(rr));
    const d = Math.max(0.02, dNow + dSd * gauss(rr));
    const L = Math.log(1 / d);
    // the curvature draw only happens when there is curvature, so plain forecasts are unchanged
    const a = aMed > 0 ? Math.max(0, aMed + aSd * gauss(rr)) : 0;
    out[i] = a > 1e-9 ? (-b + Math.sqrt(b * b + 4 * a * L)) / (2 * a) : L / b;
  }
  out.sort();
  const q = (p: number) => out[Math.min(n - 1, Math.max(0, Math.floor(p * n)))];
  const cdf = (t: number) => {
    let lo = 0, hi = n;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (out[mid] <= t) lo = mid + 1; else hi = mid; }
    return lo / n;
  };
  return { n, q, cdf, p10: q(0.1), p50: q(0.5), p90: q(0.9), bMed, bSigma, dNow, aMed };
}

// ---------------------------------------------------------------- rupees
export const COST = {
  // margin and wages are the powerloom's (the /model study uses them); costs() reads the active shed's
  downtimeH: 16, marginH: 700, wagesH: 250, part: 380, premium: 0.6,
  callout: 1500, pSecondary: 0.2, secondary: 20000, labour: 900,
  altDealerDays: 3, // second dealer's lead time when the first is out of stock
};

export interface Window {
  id: 'now' | 'thu' | 'sun' | 'rtf';
  when: string; note: string; t: number; lostH: number;
  F: number; E: number; plannedHere: number; feasible: boolean; why?: string;
}
export interface Scenario { powerCut: boolean; partInStock: boolean }
export const BASE_SCENARIO: Scenario = { powerCut: true, partInStock: true };

/** Expected cost per repair window: E[C(t)] = F(t)·C_breakdown + (1 − F(t))·(C_planned + lost output). */
export function costs(r: Rul, sc: Scenario = BASE_SCENARIO) {
  const shed = activeShed();
  const marginH = Math.round(shed.marginH * activeOrders().m);
  const perH = marginH + shed.wagesH;
  const f = activeFault();
  // Thursday is free only when the setup's power cuts are scheduled and the switch says it is on
  const cut = sc.powerCut && activeSetup().power === 'scheduled';
  const parts = {
    downtime: COST.downtimeH * perH,
    part: f.price * (1 + COST.premium),
    callout: COST.callout,
    secondary: COST.pSecondary * COST.secondary,
  };
  const unplanned = parts.downtime + parts.part + parts.callout + parts.secondary;
  const planned = f.price + f.labour;
  const partReadyIn = sc.partInStock ? 0 : COST.altDealerDays;
  const raw: Omit<Window, 'F' | 'E' | 'plannedHere' | 'feasible'>[] = [
    { id: 'now', when: `Today, stop the ${shed.noun} now`, note: '4 h of output lost', t: 0.02, lostH: 4 },
    { id: 'thu', when: 'Thu 19 Nov, 14:00–18:00', note: cut ? 'Scheduled power cut' : activeSetup().power === 'scheduled' ? 'Power cut cancelled · 4 h lost' : 'No power cut planned · 4 h lost', t: 50 / 24, lostH: cut ? 0 : 4 },
    { id: 'sun', when: 'Sun 22 Nov, morning', note: 'Weekly off', t: 118 / 24, lostH: 0 },
    { id: 'rtf', when: 'Run to failure', note: 'Breakdown at an unplanned time', t: Infinity, lostH: 0 },
  ];
  const windows: Window[] = raw.map((w) => {
    const feasible = w.id === 'rtf' || w.t >= partReadyIn;
    const F = w.t === Infinity ? 1 : r.cdf(w.t);
    const plannedHere = planned + w.lostH * perH;
    return {
      ...w, F, plannedHere, feasible,
      E: F * unplanned + (1 - F) * plannedHere,
      why: feasible ? undefined : `Part arrives in ${partReadyIn} days`,
    };
  });
  const best = windows.filter((w) => w.feasible).reduce((a, b) => (b.E < a.E ? b : a));
  return { perH, marginH, wagesH: shed.wagesH, parts, unplanned, planned, windows, best, saving: unplanned - best.E, partReadyIn };
}
export type Costs = ReturnType<typeof costs>;

// ---------------------------------------------------------------- diagnosis
export type EvidenceId = 'env' | 'kurt' | 'note' | 'temp' | 'x1' | 'bpfi' | 'bpfiPk' | 'x1up' | 'x2up' | 'hf' | 'harm' | 'quiet';
export interface Hypothesis { id: string; name: string; prior: number; lr: Record<EvidenceId, number> }
export const HYPOTHESES: Hypothesis[] = [
  // bpfiPk: a peak at BPFI with 1× sidebands · x1up: 1× well above baseline · x2up: 2× risen
  // hf: a broadband high-frequency rise with no tone · harm: a ladder of four or more shaft harmonics
  { id: 'BRG-OR-01', name: 'Bearing outer-race defect', prior: 0.18, lr: { env: 8.0, kurt: 3.0, note: 1.8, temp: 1.4, x1: 1.0, bpfi: 1.2, bpfiPk: 0.4, x1up: 0.8, x2up: 0.8, hf: 1.3, harm: 0.8, quiet: 0.15 } },
  { id: 'BRG-LUB-02', name: 'Lubrication starvation', prior: 0.14, lr: { env: 1.5, kurt: 1.8, note: 1.5, temp: 2.5, x1: 1.0, bpfi: 1.0, bpfiPk: 1.2, x1up: 1.0, x2up: 1.0, hf: 7.0, harm: 0.8, quiet: 0.7 } },
  { id: 'LSN-01', name: 'Mechanical looseness', prior: 0.1, lr: { env: 0.7, kurt: 1.5, note: 1.6, temp: 1.0, x1: 0.7, bpfi: 1.0, bpfiPk: 0.8, x1up: 2.5, x2up: 2.5, hf: 1.0, harm: 8.0, quiet: 1.2 } },
  { id: 'BRG-IR-01', name: 'Bearing inner-race defect', prior: 0.1, lr: { env: 0.6, kurt: 3.0, note: 1.8, temp: 1.4, x1: 1.0, bpfi: 0.2, bpfiPk: 9.0, x1up: 0.9, x2up: 0.9, hf: 1.2, harm: 0.9, quiet: 0.2 } },
  { id: 'ALN-02', name: 'Belt or shaft misalignment', prior: 0.17, lr: { env: 0.4, kurt: 0.8, note: 1.2, temp: 1.3, x1: 0.5, bpfi: 1.0, bpfiPk: 0.5, x1up: 2.0, x2up: 7.0, hf: 0.8, harm: 1.5, quiet: 1.3 } },
  { id: 'MTR-RB-01', name: 'Motor rotor bar', prior: 0.08, lr: { env: 0.3, kurt: 0.7, note: 0.6, temp: 1.3, x1: 1.0, bpfi: 1.0, bpfiPk: 0.6, x1up: 1.2, x2up: 1.0, hf: 1.5, harm: 1.0, quiet: 1.1 } },
  { id: 'UNB-01', name: 'Unbalance', prior: 0.16, lr: { env: 0.3, kurt: 0.6, note: 0.8, temp: 1.0, x1: 0.2, bpfi: 1.0, bpfiPk: 0.3, x1up: 8.0, x2up: 0.6, hf: 0.6, harm: 0.7, quiet: 1.3 } },
  { id: 'SNS-00', name: 'Sensor or mounting fault', prior: 0.07, lr: { env: 0.05, kurt: 0.3, note: 0.5, temp: 0.8, x1: 1.2, bpfi: 1.0, bpfiPk: 0.1, x1up: 0.6, x2up: 0.6, hf: 1.5, harm: 0.5, quiet: 0.8 } },
];

export interface Evidence { id: EvidenceId; rule: string; text: string }
/** The evidence terms, worded from the spectrum and the wear severity of the card they describe
 *  (severity 1 is card 56). Which terms are present on a given card is decided in replay.ts. */
export function evidence(s: Spectrum, severity = 1): Evidence[] {
  const f = spectrumFacts(s);
  const kurt = 3.1 + 2.6 * severity, dT = 6.1 * severity * severity;
  const harm = f.harmonics.length ? `, with ${f.harmonics.map((h) => h + '×').join(' and ')} harmonics` : ', no harmonics yet';
  return [
    { id: 'env', rule: 'BRG-OR-01 · e1', text: `Envelope peak at BPFO ${f.peakHz.toFixed(1)} Hz, ${f.overBase.toFixed(1)} dB over its baseline${harm}` },
    { id: 'kurt', rule: 'BRG-OR-01 · e2', text: `Kurtosis ${kurt.toFixed(1)} against a baseline of 3.1: the signal has turned impulsive` },
    { id: 'note', rule: 'BRG-OR-01 · e3', text: `${activeShed().note.who} reported a knocking sound at 09:42` },
    { id: 'temp', rule: 'BRG-OR-01 · e4', text: `Housing ${dT.toFixed(1)} °C above its load-matched baseline` },
    { id: 'bpfi', rule: 'BRG-IR-01 · e1', text: `No peak at BPFI ${f.bpfi.toFixed(1)} Hz (${f.bpfiExcess.toFixed(1)} dB, within noise)` },
    { id: 'x1', rule: 'UNB-01 · e1', text: '1× shaft amplitude unchanged since week one' },
    ...extraEvidence(s),
  ];
}

function extraEvidence(s: Spectrum): Evidence[] {
  const r = readSpectrum(s);
  return [
    { id: 'bpfiPk', rule: 'BRG-IR-01 · e2', text: `Envelope peak at BPFI ${r.bpfiHz.toFixed(1)} Hz, ${r.bpfi.toFixed(1)} dB over the floor, with sidebands one shaft speed either side` },
    { id: 'x1up', rule: 'UNB-01 · e2', text: `1× shaft at ${r.fr.toFixed(2)} Hz stands ${r.x1.toFixed(1)} dB over the floor, ${(r.x1 - r.x1base).toFixed(1)} dB above its first week` },
    { id: 'x2up', rule: 'ALN-02 · e1', text: `2× shaft stands ${r.x2.toFixed(1)} dB over the floor, against ${r.x2base.toFixed(1)} dB in the first week` },
    { id: 'hf', rule: 'BRG-LUB-02 · e1', text: `Broadband rise of ${r.hf.toFixed(1)} dB from 150 to 390 Hz, with no bearing tone standing out` },
    { id: 'quiet', rule: 'BRG-OR-01 · e1, BRG-IR-01 · e2', text: `No envelope peak at the bearing tones: BPFO ${r.bpfo.toFixed(1)} dB and BPFI ${r.bpfi.toFixed(1)} dB over the floor, within noise` },
    { id: 'harm', rule: 'LSN-01 · e1', text: `A ladder of shaft harmonics: ${r.harmonics >= 7 ? 'seven' : r.harmonics} orders of the shaft speed stand out of the floor` },
  ];
}

/** P(h | e) ∝ P(h) · Π P(e_i | h) / P(e_i | ¬h), normalised over the rulebook's hypotheses. */
export function posterior(ids: EvidenceId[]) {
  const rows = HYPOTHESES.map((h) => ({ ...h, w: h.prior * ids.reduce((acc, e) => acc * (h.lr[e] ?? 1), 1) }));
  const z = rows.reduce((s, r) => s + r.w, 0);
  return rows.map((r) => ({ ...r, p: r.w / z })).sort((a, b) => b.p - a.p);
}
export type Ranked = ReturnType<typeof posterior>;

/** The worker's voice note on the hero machine, card 56, 09:42: who leaves it depends on the shed. */
export const NOTE_K = 55;
export const workerNote = () => ({ machine: heroId(), k: NOTE_K, time: '09:42', lr: 1.8, rule: 'BRG-OR-01 · e3', ...activeShed().note });

export { defectFactors };
