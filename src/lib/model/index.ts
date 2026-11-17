// One deterministic model for the whole app. The same seed gives the same shed on the
// server and in every browser, so pages can render it anywhere without drift.
import { buildShed, type Machine } from './shed';
import { activeSetup, heroId, isQuiet, setupKey } from './setup';
import { evidenceAt, postAt, spectrumAt } from './replay';
import { N_PAST } from './core';
import { costs, type EvidenceId, type Rul } from './decide';

const NEVER: Rul = { n: 0, q: () => Infinity, cdf: () => 0, p10: Infinity, p50: Infinity, p90: Infinity, bMed: 0, bSigma: 0, dNow: 0, aMed: 0 };
import { speedFrom1x } from './physics';

export * from './core';
export * from './shed';
export * from './physics';
export * from './decide';
export * from './replay';
export * from './setup';
export * from './sheds';

export const ALL_EVIDENCE: EvidenceId[] = ['env', 'kurt', 'note', 'temp', 'bpfi', 'x1'];

function build() {
  const machines = buildShed();
  const byId = Object.fromEntries(machines.map((m) => [m.id, m])) as Record<string, Machine>;
  // `loom` is the hero machine: Loom 03 in the powerloom shed, Chakki 3 in the mill, Pump 3 in the pump house
  const loom = byId[heroId()];
  const now = N_PAST - 1;
  // today's spectrum, evidence and ranking are the replay's, read at card 56
  const spec = spectrumAt(loom, now);
  return {
    setup: activeSetup(),
    machines,
    byId,
    loom,
    spec,
    measuredRpm: Math.round(speedFrom1x(spec)),
    evidence: evidenceAt(loom, now, true),
    post: postAt(loom, now, true),
    postNoNote: postAt(loom, now, false),
    /** a healthy fortnight: nothing to forecast, rank or price; the views say so instead */
    quiet: isQuiet() || !loom.rul,
    // priced against a forecast that never fails when the fortnight is quiet; no view shows it then
    cost: costs(loom.rul ?? NEVER),
  };
}

// one model per setup; switching back to a setup reuses it
const cache = new Map<string, ReturnType<typeof build>>();
export function getModel() {
  const key = setupKey(activeSetup());
  let m = cache.get(key);
  if (!m) { m = build(); cache.set(key, m); }
  return m;
}
export type NaadiModel = ReturnType<typeof getModel>;
