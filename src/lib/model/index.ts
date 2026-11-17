// One deterministic model for the whole app. The same seed gives the same shed on the
// server and in every browser, so pages can render it anywhere without drift.
import { buildShed, type Machine } from './shed';
import { costs, evidence, posterior, type EvidenceId } from './decide';
import { envelopeSpectrum, speedFrom1x } from './physics';

export * from './core';
export * from './shed';
export * from './physics';
export * from './decide';
export * from './replay';

export const ALL_EVIDENCE: EvidenceId[] = ['env', 'kurt', 'note', 'temp', 'bpfi', 'x1'];

function build() {
  const machines = buildShed();
  const byId = Object.fromEntries(machines.map((m) => [m.id, m])) as Record<string, Machine>;
  const loom = byId.L03;
  const spec = envelopeSpectrum();
  return {
    machines,
    byId,
    loom,
    spec,
    measuredRpm: Math.round(speedFrom1x(spec)),
    evidence: evidence(spec),
    post: posterior(ALL_EVIDENCE),
    postNoNote: posterior(ALL_EVIDENCE.filter((e) => e !== 'note')),
    cost: costs(loom.rul!),
  };
}

let cached: ReturnType<typeof build> | null = null;
export function getModel() {
  if (!cached) cached = build();
  return cached;
}
export type NaadiModel = ReturnType<typeof getModel>;
