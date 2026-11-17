// The model as of any card: what NAADI knew at the end of card k, using only cards 0…k.
// The case-file replay, the floor readout and the calibration study all read from here,
// so a replayed forecast is exactly the forecast the agents would have made that day.
import { N_PAST, clamp } from './core';
import { CHANNELS, forecast, pageHinkley, type Card, type Curve, type Growth, type Machine, type PageHinkley } from './shed';
import { NOTES, evidence, posterior, type Evidence, type Ranked, type Rul } from './decide';
import { envelopeSpectrum, type Spectrum } from './physics';

export interface AsOf {
  k: number;
  /** The last scored card at or before k (machines are not scored while off). */
  scored: Card;
  ph: PageHinkley | null;
  /** first card of the growth fit, once there is one */
  fitFrom: number | null;
  fit: Growth | null;
  /** the curvature fit, when wear was speeding up significantly and the forecast used it */
  curve: Curve | null;
  rul: Rul | null;
  /** Where the card sits on this machine's wear path: 0 is its own first-week normal, 1 is card 56. */
  severity: number;
  /** The diagnostician runs once a change point is detected or the card leaves normal. */
  diagnosing: boolean;
}

export function scoredAt(m: Machine, k: number): Card {
  for (let i = Math.min(k, m.cards.length - 1); i >= 0; i--) if (!m.cards[i].off) return m.cards[i];
  return m.cards[0];
}

/** A channel's hole is steady when it was punched on at least `need` of the last `look` scored cards. */
export function steadyHole(m: Machine, k: number, channel: string, look = 6, need = 2) {
  const i = CHANNELS.findIndex((c) => c.id === channel);
  const recent: Card[] = [];
  for (let j = k; j >= 0 && recent.length < look; j--) if (!m.cards[j].off) recent.push(m.cards[j]);
  return recent.filter((c) => c.holes[i]).length >= need;
}

function baseLevel(m: Machine) {
  const first = m.cards.filter((c) => !c.off).slice(0, 8).map((c) => c.dS).sort((a, b) => a - b);
  return (first[3] + first[4]) / 2;
}

export function severityAt(m: Machine, k: number) {
  if (!m.prof) return 0;
  const base = baseLevel(m);
  return clamp(Math.log(scoredAt(m, k).dS / base) / Math.log(m.now.dS / base), 0, 1);
}

const asOfCache = new Map<string, AsOf>();
export function asOf(m: Machine, k: number): AsOf {
  const key = m.id + ':' + k;
  const hit = asOfCache.get(key);
  if (hit) return hit;
  const cards = m.cards.slice(0, k + 1);
  const scored = scoredAt(m, k);
  // change detection runs on the machines that carry a fault profile, as on the floor today
  const ph = m.prof ? pageHinkley(cards) : null;
  // the same forecast as today's, made only from the cards seen so far
  const fc = ph ? forecast(cards, ph) : null;
  const out: AsOf = {
    k, scored, ph, fitFrom: fc?.start ?? null, fit: fc?.fit ?? null, curve: fc?.curve ?? null, rul: fc?.rul ?? null,
    severity: severityAt(m, k), diagnosing: !!ph || scored.state === 'watch' || scored.state === 'act',
  };
  asOfCache.set(key, out);
  return out;
}

const specCache = new Map<number, Spectrum>();
/** Loom 03's envelope spectrum on the last scored card at or before k. Card 56 is the case file's spectrum. */
export function spectrumAt(m: Machine, k: number): Spectrum {
  const c = scoredAt(m, k);
  const hit = specCache.get(c.k);
  if (hit) return hit;
  // each card is its own measurement: fresh noise, the same physics
  const s = envelopeSpectrum(3 + (N_PAST - 1 - c.k) * 7, severityAt(m, c.k));
  specCache.set(c.k, s);
  return s;
}

/** The evidence the diagnostician would have had at card k, from steady holes on the card chain. */
export function evidenceAt(m: Machine, k: number, useNote = true): Evidence[] {
  const a = asOf(m, k);
  if (!a.diagnosing || m.id !== 'L03') return [];
  const all = Object.fromEntries(evidence(spectrumAt(m, k), a.severity).map((e) => [e.id, e]));
  const out: Evidence[] = [];
  const env = steadyHole(m, k, 'ENV');
  if (env) out.push(all.env);
  if (steadyHole(m, k, 'KURT')) out.push(all.kurt);
  if (useNote && k >= NOTES[0].k) out.push(all.note);
  if (steadyHole(m, k, 'TMP')) out.push(all.temp);
  if (env) out.push(all.bpfi); // only worth checking once there is an envelope peak to explain
  out.push(all.x1);
  return out;
}

/** Ranked causes at card k: the rulebook's priors until the diagnostician starts. */
export function postAt(m: Machine, k: number, useNote = true): Ranked {
  return posterior(evidenceAt(m, k, useNote).map((e) => e.id));
}
