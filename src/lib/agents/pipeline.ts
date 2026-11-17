// The agent run, as data. Every result below comes from a deterministic tool; the agents
// decide which tool to call next and draft the outward messages. Anything that leaves the
// shed (a WhatsApp, a booking) stops at a gate the owner must open.
import { ACT_AT, inr, pct } from '@/lib/model/core';
import { splitHoles } from '@/lib/model/shed';
import { costs, posterior, type EvidenceId, type Scenario } from '@/lib/model/decide';
import { spectrumFacts } from '@/lib/model/physics';
import { ALL_EVIDENCE, type NaadiModel } from '@/lib/model';

export type Agent = 'Sentinel' | 'Diagnostician' | 'Worker note' | 'Prognostician' | 'Procurement' | 'Planner' | 'Dispatcher' | 'Owner';
export interface Step {
  id: string;
  at: string;
  agent: Agent;
  call: string;
  result: string;
  kind: 'tool' | 'gate' | 'human';
  cites?: string[];
  waiting?: boolean;
}
export interface RunInput { scenario: Scenario; useNote: boolean; decision: 'open' | 'approved' | 'snoozed' }

export function planRun(model: NaadiModel, input: RunInput) {
  const L = model.loom;
  const c = L.cards[L.cards.length - 1];
  const { steady, isolated } = splitHoles(L, c.k);
  const lc = (a: string[]) => a.map((s) => s.toLowerCase()).join(', ');
  const facts = spectrumFacts(model.spec);
  const ids: EvidenceId[] = input.useNote ? ALL_EVIDENCE : ALL_EVIDENCE.filter((e) => e !== 'note');
  const post = posterior(ids);
  const other = posterior(input.useNote ? ALL_EVIDENCE.filter((e) => e !== 'note') : ALL_EVIDENCE);
  const r = L.rul!, fit = L.fit!, ph = L.ph!;
  const cost = costs(r, input.scenario);
  const best = cost.best;
  const out = cost.windows.filter((w) => !w.feasible).map((w) => w.when.split(',')[0]);
  const steps: Step[] = [
    {
      id: 'score', at: '09:41:02', agent: 'Sentinel', kind: 'tool', call: 'scoreCard(56, regime = "full load")',
      result: `Holes punched in ${lc(steady)}.${isolated.length ? ` One isolated hole in ${lc(isolated)}, within the 1% false-hole rate, so it carries no weight.` : ''} Degradation ${c.dS.toFixed(3)} against an act level of ${ACT_AT}.`,
    },
    {
      id: 'peaks', at: '09:41:03', agent: 'Diagnostician', kind: 'tool', call: `envelopePeaks(fr = ${(model.measuredRpm / 60).toFixed(2)} Hz)`,
      result: `BPFO ${facts.peakHz.toFixed(1)} Hz at ${facts.overBase.toFixed(1)} dB over baseline; ${facts.harmonics.map((h) => h + '×').join(' and ')} present; nothing at BPFI.`,
    },
    {
      id: 'rules', at: '09:41:03', agent: 'Diagnostician', kind: 'tool', call: 'queryRulebook("BRG-*", "UNB-*", "ALN-*")',
      result: 'BRG-OR-01 evidence e1, e2 and e4 matched; the BPFI gap and an unchanged 1× argue against BRG-IR-01 and UNB-01.',
      cites: ['BRG-OR-01', 'BRG-IR-01', 'UNB-01'],
    },
    {
      id: 'note', at: '09:42:40', agent: 'Worker note', kind: 'human', call: 'transcribe(voice, lang = "mr")',
      result: input.useNote ? 'Sunita K.: “खट-खट आवाज येतोय” → BRG-OR-01 e3, likelihood ratio 1.8.' : 'Sunita K.’s note is set aside for this run.',
      cites: input.useNote ? ['BRG-OR-01'] : undefined,
    },
    {
      id: 'rank', at: '09:42:41', agent: 'Diagnostician', kind: 'tool', call: `bayesRank(8 hypotheses, ${ids.length} evidence)`,
      result: `${post[0].name} ${(post[0].p * 100).toFixed(1)}%${input.useNote ? `, up from ${(other[0].p * 100).toFixed(1)}% before the note` : `; with the note it would be ${(other[0].p * 100).toFixed(1)}%`}.`,
    },
    {
      id: 'rul', at: '09:42:42', agent: 'Prognostician', kind: 'tool', call: `fitGrowth(cards ${(L.fitFrom ?? ph.onset) + 1}–56) · monteCarlo(n = ${r.n.toLocaleString('en-IN')})`,
      result: `Fit starts at card ${(L.fitFrom ?? ph.onset) + 1}, the first clear of this loom's normal band: b = ${fit.b.toFixed(3)} per day. Time to failure P10 ${r.p10.toFixed(1)} d, P50 ${r.p50.toFixed(1)} d, P90 ${r.p90.toFixed(1)} d; ${pct(r.cdf(7))} within 7 days.`,
    },
    {
      id: 'stock', at: '09:42:42', agent: 'Procurement', kind: 'tool', call: 'checkStock(dealers, "6205-2RS")',
      result: input.scenario.partInStock
        ? 'Laxmi Bearing House has 6205-2RS in stock at ₹380; pickup the same day.'
        : `Laxmi Bearing House is out of stock. Second dealer can deliver in ${cost.partReadyIn} days.`,
    },
    {
      id: 'plan', at: '09:42:43', agent: 'Planner', kind: 'tool', call: `optimiseRepairWindow(4 windows, powerCut = ${input.scenario.powerCut}, partInStock = ${input.scenario.partInStock})`,
      result: `${best.when}, ${best.note.toLowerCase()}: ${inr(best.E)} expected against ${inr(cost.unplanned)} for a breakdown.${out.length ? ` Not possible without the part: ${out.join(', ')}.` : ''}`,
    },
    {
      id: 'draft', at: '09:42:44', agent: 'Procurement', kind: 'gate', call: 'draftWhatsApp(dealer, "6205-2RS × 2")',
      result: input.decision === 'approved' ? 'Draft is on the owner’s phone, ready to send.' : 'Draft prepared. Waiting for the owner.',
      waiting: input.decision !== 'approved',
    },
    {
      id: 'hold', at: '09:42:44', agent: 'Dispatcher', kind: 'gate', call: `holdSlot(technician, "${best.when}")`,
      result: input.decision === 'approved' ? 'Held for Loom 03.' : 'Tentative hold. Waiting for the owner.',
      waiting: input.decision !== 'approved',
    },
  ];
  if (input.decision === 'approved') {
    steps.push({ id: 'owner', at: '12:04:10', agent: 'Owner', kind: 'human', call: `approve(repair, "${best.when}")`, result: 'Approved. Messages leave only when the owner taps send.' });
  }
  return { steps, post, cost };
}
