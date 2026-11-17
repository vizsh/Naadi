// A simulation study of NAADI's maths, run on the demo's own generative model.
// Many simulated 6205 bearings, each with a random onset, starting size and wear rate, are
// run to failure; healthy machines run for months to count false alarms. Every faulty run is
// scored by the pipeline exactly as built (Page–Hinkley, growth fit, Monte Carlo, the repair
// policy), using only the cards it had seen at the time. This tests that the pipeline is
// internally consistent and calibrated when its assumptions hold, and how it degrades when
// they do not. It is not field accuracy: that needs public run-to-failure data (docs/07).
import { ACT_AT, WATCH_AT, gauss, mulberry32, type State } from './core';
import { FORECAST, fitGrowth, forecast, pageHinkley, type Card, type PageHinkley } from './shed';
import { COST, rul, type Rul } from './decide';

export interface StudyOptions {
  faulty: number;
  healthy: number;
  /** months of running per healthy machine */
  months: number;
  seed: number;
  /** wear accelerates (d = d0·e^{bτ + aτ²}) while the forecast still assumes plain exponential growth */
  accelerate: boolean;
  /** the model-form prior on the growth rate that the forecast adds to the fit's own error */
  prior: boolean;
  /** 'current' fits from the first card clear of the normal band; 'first' is the first version,
   *  which fitted from the change point with a ±25% prior and no allowance for smoothing */
  method: 'current' | 'first';
}
export const STUDY_DEFAULTS: StudyOptions = { faulty: 240, healthy: 120, months: 4, seed: 2026, accelerate: false, prior: true, method: 'current' };

export interface Check { k: number; age: number; remaining: number; p10: number; p50: number; p90: number; pit: number }
export type Outcome = 'sunday' | 'now' | 'breakdown';
export interface FaultyRun {
  id: number;
  t0: number; d0: number; b: number; a: number;
  tFail: number;
  alarmK: number | null;
  /** days of warning between the end of the change-detected card and the failure */
  lead: number | null;
  actK: number | null;
  checks: Check[];
  outcome: Outcome;
  cost: number;
}
export interface StudyResult {
  opts: StudyOptions;
  runs: FaultyRun[];
  detected: number;
  lead: { p10: number; p50: number; p90: number; min: number };
  coverage: { all: number; early: number; late: number; n: number; nEarly: number; nLate: number };
  pitBins: number[];
  /** the share of checks where the failure came later than the forecast's P90 (forecast too early) */
  late90: number;
  /** the share where it came before P10 (forecast too late, the dangerous side) */
  early10: number;
  falseAlarms: number;
  healthyMonths: number;
  falsePerMonth: number;
  watchOnHealthy: number;
  costs: { rtf: number; policy: number; sunday: number; now: number; breakdown: number; saving: number };
}

const CARDS_PER_DAY = 4;
/** Sundays off: the seventh day of every week, four cards. */
const isOff = (k: number) => Math.floor(k / CARDS_PER_DAY) % 7 === 6;
const quantile = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];
};

function simulateCards(rng: () => number, base: number, dTrue: (t: number) => number, until: number): Card[] {
  const cards: Card[] = [];
  let dS = base;
  for (let k = 0; (k + 0.5) / CARDS_PER_DAY < until; k++) {
    const t = (k + 0.5) / CARDS_PER_DAY;
    const off = isOff(k);
    let d = base * Math.exp(0.08 * gauss(rng));
    const dt = dTrue(t);
    if (dt > 0) d = Math.max(d, dt * Math.exp(0.05 * gauss(rng)));
    if (!off) dS = 0.5 * d + 0.5 * dS;
    const state: State = off ? 'off' : dS >= ACT_AT ? 'act' : dS >= WATCH_AT ? 'watch' : 'normal';
    cards.push({ k, t, d, dS, state, off, holes: [], n: 0 });
  }
  return cards;
}

/** The forecast under test, made only from `seen`. */
function predict(seen: Card[], ph: PageHinkley, opts: StudyOptions, seed: number): Rul | null {
  if (opts.method === 'current') return forecast(seen, ph, { n: 400, seed, prior: opts.prior ? FORECAST.prior : 0 })?.rul ?? null;
  // the first version: from the change point, ±25% prior, the fit's error taken at face value
  if (seen.filter((c) => !c.off && c.k >= ph.onset).length < 4) return null;
  const fit = fitGrowth(seen, ph.onset);
  if (!(fit.b > 0.02)) return null;
  const last = [...seen].reverse().find((c) => !c.off)!;
  return rul(last.dS, { bMed: fit.b, bSigma: opts.prior ? Math.hypot(fit.se / fit.b, 0.25) : fit.se / fit.b, n: 400, seed });
}

/** The study as a sequence of small steps, so a page can run it without freezing. */
export function createStudy(opts: StudyOptions = STUDY_DEFAULTS) {
  const rng = mulberry32(opts.seed);
  const perH = COST.marginH + COST.wagesH;
  const unplanned = COST.downtimeH * perH + COST.part * (1 + COST.premium) + COST.callout + COST.pSecondary * COST.secondary;
  const planned = COST.part + COST.labour;
  const runs: FaultyRun[] = [];
  let i = 0, h = 0, falseAlarms = 0, watchOnHealthy = 0;

  const faulty = () => {
    const base = 0.012 + 0.012 * rng();
    const t0 = 2 + 6 * rng();
    const d0 = 0.03 + 0.03 * rng();
    const b = 0.17 * Math.exp(0.35 * gauss(rng));
    const a = opts.accelerate ? 0.006 + 0.012 * rng() : 0;
    const L = Math.log(1 / d0);
    const tau = a > 0 ? (-b + Math.sqrt(b * b + 4 * a * L)) / (2 * a) : L / b;
    const tFail = t0 + tau;
    const dTrue = (t: number) => (t < t0 ? 0 : d0 * Math.exp(b * (t - t0) + a * (t - t0) ** 2));
    const cards = simulateCards(rng, base, dTrue, tFail);
    const ph = pageHinkley(cards);
    const alarmK = ph ? ph.alarm : null;
    const lead = alarmK !== null ? tFail - (alarmK + 1) / CARDS_PER_DAY : null;
    const checks: Check[] = [];
    if (ph) {
      // one check per day of running after detection, each made only from the cards seen by then
      for (let k = ph.alarm; k < cards.length; k += CARDS_PER_DAY) {
        if (cards[k].off) continue;
        const r = predict(cards.slice(0, k + 1), ph, opts, 1 + k + 97 * i);
        if (!r) continue;
        const remaining = tFail - (k + 1) / CARDS_PER_DAY;
        checks.push({ k, age: (k - ph.alarm) / CARDS_PER_DAY, remaining, p10: r.p10, p50: r.p50, p90: r.p90, pit: r.cdf(remaining) });
      }
    }
    // the repair policy: at the first act card, book the next Sunday unless the chance of
    // failing first is over 10%, in which case stop at the next shift change (4 h lost)
    const act = cards.find((c) => c.state === 'act') ?? null;
    let outcome: Outcome = 'breakdown', cost = unplanned;
    if (act && ph && act.k >= ph.alarm) {
      const r = predict(cards.slice(0, act.k + 1), ph, opts, 5 + i);
      const tNow = (act.k + 1) / CARDS_PER_DAY;
      let sunday = Math.ceil(tNow);
      while (sunday % 7 !== 6) sunday++;
      const tSunday = sunday + 0.25;
      const pFirst = r ? r.cdf(tSunday - tNow) : 1;
      const tRepair = pFirst > 0.1 ? tNow + 0.25 : tSunday;
      outcome = pFirst > 0.1 ? 'now' : 'sunday';
      cost = outcome === 'now' ? planned + 4 * perH : planned;
      if (tFail < tRepair) { outcome = 'breakdown'; cost = unplanned; }
    }
    runs.push({ id: i, t0, d0, b, a, tFail, alarmK, lead, actK: act ? act.k : null, checks, outcome, cost });
  };

  // healthy machines: count change-point alarms, restarting detection after each one
  const healthy = () => {
    const base = 0.012 + 0.012 * rng();
    const cards = simulateCards(rng, base, () => 0, opts.months * 30);
    watchOnHealthy += cards.filter((c) => c.state === 'watch' || c.state === 'act').length;
    let from = 0;
    while (from < cards.length) {
      const ph = pageHinkley(cards.slice(from));
      if (!ph) break;
      falseAlarms++;
      from = ph.alarm + 1; // cards keep their own index, so the alarm is absolute
    }
  };

  const total = opts.faulty + opts.healthy;
  return {
    get progress() { return (i + h) / Math.max(1, total); },
    get done() { return i >= opts.faulty && h >= opts.healthy; },
    /** Run for about `budgetMs`; returns true when the study is finished. */
    step(budgetMs = Infinity) {
      const t0 = Date.now();
      while (!this.done && Date.now() - t0 < budgetMs) {
        if (i < opts.faulty) { faulty(); i++; } else { healthy(); h++; }
      }
      return this.done;
    },
    result(): StudyResult {
      const checks = runs.flatMap((r) => r.checks);
      const inside = (c: Check) => c.pit > 0.1 && c.pit <= 0.9;
      const early = checks.filter((c) => c.age < 2), late = checks.filter((c) => c.age >= 2);
      const share = (xs: Check[], f: (c: Check) => boolean) => (xs.length ? xs.filter(f).length / xs.length : NaN);
      const pitBins = Array.from({ length: 10 }, () => 0);
      for (const c of checks) pitBins[Math.min(9, Math.floor(c.pit * 10))]++;
      const leads = runs.filter((r) => r.lead !== null && r.lead > 0).map((r) => r.lead!);
      const n = runs.length;
      const count = (o: Outcome) => runs.filter((r) => r.outcome === o).length;
      const policy = runs.reduce((s, r) => s + r.cost, 0) / Math.max(1, n);
      return {
        opts, runs,
        detected: leads.length / Math.max(1, n),
        lead: { p10: quantile(leads, 0.1), p50: quantile(leads, 0.5), p90: quantile(leads, 0.9), min: leads.length ? Math.min(...leads) : NaN },
        coverage: { all: share(checks, inside), early: share(early, inside), late: share(late, inside), n: checks.length, nEarly: early.length, nLate: late.length },
        pitBins,
        late90: share(checks, (c) => c.pit > 0.9),
        early10: share(checks, (c) => c.pit <= 0.1),
        falseAlarms, healthyMonths: opts.healthy * opts.months,
        falsePerMonth: falseAlarms / Math.max(1, opts.healthy * opts.months),
        watchOnHealthy,
        costs: { rtf: unplanned, policy, sunday: count('sunday'), now: count('now'), breakdown: count('breakdown'), saving: unplanned - policy },
      };
    },
  };
}

export function runStudy(opts: StudyOptions = STUDY_DEFAULTS): StudyResult {
  const s = createStudy(opts);
  s.step();
  return s.result();
}
