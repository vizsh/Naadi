// Model checks: asserts the invariants the UI relies on and prints the numbers the docs quote.
//   npm run test:model
import { getModel, costs, posterior, defectFactors, cursorFit, asOf, postAt, ALL_EVIDENCE, N_PAST, inr, pct } from '../src/lib/model';
import { runStudy, STUDY_DEFAULTS } from '../src/lib/model/study';
import { DEFAULT_SETUP, FAULTS, setActiveSetup, type Setup } from '../src/lib/model/setup';
import { SHEDS, SHED_IDS } from '../src/lib/model/sheds';

const m = getModel();
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ·  ' + detail : ''}`);
  if (!ok) failures++;
};

const F = defectFactors();
check('6205 factors', Math.abs(F.BPFO - 3.5848) < 1e-3 && Math.abs(F.BPFI - 5.4152) < 1e-3 && Math.abs(F.FTF - 0.3983) < 1e-3, `BPFO ${F.BPFO.toFixed(4)} BPFI ${F.BPFI.toFixed(4)} BSF ${F.BSF.toFixed(4)} FTF ${F.FTF.toFixed(4)}`);
check('speed recovered from 1× peak', Math.abs(m.measuredRpm - 1436) <= 3, `${m.measuredRpm} rpm`);
check('cursors fit at measured speed', cursorFit(m.spec, m.measuredRpm) > 8, `${cursorFit(m.spec, m.measuredRpm).toFixed(1)} dB`);
check('cursors miss 3% off speed', cursorFit(m.spec, m.measuredRpm * 0.97) < 4, `${cursorFit(m.spec, m.measuredRpm * 0.97).toFixed(1)} dB`);

const states = Object.fromEntries(m.machines.map((x) => [x.id, x.now.state]));
check('states now', states.L03 === 'act' && states.P02 === 'watch' && states.L05 === 'watch' && ['L01', 'L02', 'L04', 'L06', 'C01', 'P01'].every((id) => states[id] === 'normal'), JSON.stringify(states));
const L = m.loom;
check('change point', !!L.ph && L.ph.alarm > L.ph.onset, `onset card ${L.ph!.onset + 1}, alarm card ${L.ph!.alarm + 1}`);
check('growth fit', !!L.fit && L.fit.b > 0.15 && L.fit.b < 0.3, `b = ${L.fit!.b.toFixed(3)} ± ${L.fit!.se.toFixed(3)} /day over ${L.fit!.n} cards`);
const r = L.rul!;
check('RUL ordering', r.p10 < r.p50 && r.p50 < r.p90, `P10 ${r.p10.toFixed(2)} · P50 ${r.p50.toFixed(2)} · P90 ${r.p90.toFixed(2)} d · P(≤7 d) ${pct(r.cdf(7))}`);

const post = posterior(ALL_EVIDENCE);
check('posterior sums to 1', Math.abs(post.reduce((s, h) => s + h.p, 0) - 1) < 1e-9);
check('leading cause', post[0].id === 'BRG-OR-01', `${post[0].name} ${(post[0].p * 100).toFixed(1)}% (without the note ${(m.postNoNote[0].p * 100).toFixed(1)}%)`);
console.log('      ranking  ' + post.map((h) => `${h.id} ${(h.p * 100).toFixed(1)}%`).join(' · '));

for (const sc of [
  { name: 'base', powerCut: true, partInStock: true },
  { name: 'power cut cancelled', powerCut: false, partInStock: true },
  { name: 'part out of stock', powerCut: true, partInStock: false },
  { name: 'both', powerCut: false, partInStock: false },
]) {
  const c = costs(r, sc);
  console.log(`      ${sc.name.padEnd(20)} best ${c.best.id.padEnd(4)} ${inr(c.best.E).padStart(8)} · saving ${inr(c.saving)} · ` + c.windows.map((w) => `${w.id}:${w.feasible ? inr(w.E) : 'n/a'} (F ${pct(w.F)})`).join(' '));
}
check('base plan is the Thursday power cut', m.cost.best.id === 'thu', `${inr(m.cost.best.E)} vs breakdown ${inr(m.cost.unplanned)}`);

const holes = m.machines.filter((x) => !x.prof).map((x) => x.cards.reduce((s, c) => s + c.n, 0));
console.log(`      isolated holes on healthy machines over ${N_PAST} cards: ${holes.join(', ')} (expected ≈ ${(8 * N_PAST * 0.006 * (48 / 56)).toFixed(1)} each)`);

// replay: the model as of card 56 is today's model, and nothing is forecast before the change point
const today = asOf(L, N_PAST - 1);
check('replay at card 56 is today', today.rul!.p50 === r.p50 && today.fit!.b === L.fit!.b && postAt(L, N_PAST - 1)[0].p === post[0].p);
check('replay: no forecast before the change point', asOf(L, L.ph!.alarm - 1).rul === null && asOf(L, L.ph!.alarm - 1).fit === null);
check('replay: diagnosis converges', postAt(L, 18)[0].p < 0.2 && postAt(L, 40)[0].p > 0.8, `card 19 ${(postAt(L, 18)[0].p * 100).toFixed(1)}% → card 41 ${(postAt(L, 40)[0].p * 100).toFixed(1)}% → card 56 ${(post[0].p * 100).toFixed(1)}%`);
const truth = L.prof!.t0 + Math.log(1 / L.prof!.d0) / L.prof!.b;
console.log(`      synthetic failure on day ${truth.toFixed(2)}; forecast failure day (P50) as of card ` + [28, 32, 36, 40, 44, 48, 52, 55].map((k) => { const a = asOf(L, k); return `${k + 1}: ${a.rul ? ((k + 1) / 4 + a.rul.p50).toFixed(1) : '—'}`; }).join(' · '));

// the simulation study on /model
const st = runStudy({ ...STUDY_DEFAULTS, faulty: 160, healthy: 80 });
check('study: P10–P90 coverage near 80% when wear is exponential', st.coverage.all > 0.75 && st.coverage.all < 0.95, `${pct(st.coverage.all)} of ${st.coverage.n} forecasts (first two days ${pct(st.coverage.early)}, later ${pct(st.coverage.late)})`);
check('study: failures before P10 stay near 10%', st.early10 < 0.15, `${pct(st.early10)} before P10, ${pct(st.late90)} after P90`);
check('study: every fault detected before failure', st.detected === 1, `lead time P10 ${st.lead.p10.toFixed(1)} d, median ${st.lead.p50.toFixed(1)} d`);
check('study: false alarms on healthy machines', st.falsePerMonth < 0.05, `${st.falseAlarms} in ${st.healthyMonths} machine-months`);
check('study: the repair policy beats running to failure', st.costs.policy < 0.2 * st.costs.rtf, `${inr(st.costs.policy)} per bearing against ${inr(st.costs.rtf)}; Sunday ${st.costs.sunday}, now ${st.costs.now}, breakdowns ${st.costs.breakdown}`);
const ac = runStudy({ ...STUDY_DEFAULTS, faulty: 160, healthy: 0, accelerate: true });
const acFlat = runStudy({ ...STUDY_DEFAULTS, faulty: 160, healthy: 0, accelerate: true, curvature: false });
check('study: the curvature term helps accelerating wear', ac.costs.breakdown < acFlat.costs.breakdown && ac.coverage.all > acFlat.coverage.all, `breakdowns ${acFlat.costs.breakdown} → ${ac.costs.breakdown} of 160, coverage ${pct(acFlat.coverage.all)} → ${pct(ac.coverage.all)}`);
console.log(`      known limit: accelerating wear → coverage ${pct(ac.coverage.all)}, ${pct(ac.early10)} fail before P10, ${ac.costs.breakdown} of ${ac.runs.length} break down`);

// every setup the bar offers: the right cause leads, a forecast exists, a feasible window is chosen
for (const fault of Object.keys(FAULTS) as (keyof typeof FAULTS)[]) {
  setActiveSetup({ ...DEFAULT_SETUP, fault });
  const mm = getModel();
  check(`setup: ${fault} is diagnosed as ${FAULTS[fault].rule}`, mm.post[0].id === FAULTS[fault].rule && !!mm.loom.rul && mm.cost.best.feasible, `${(mm.post[0].p * 100).toFixed(1)}% · ${mm.evidence.map((e) => e.id).join(', ')} · ${mm.cost.best.id} ${inr(mm.cost.best.E)}`);
}
for (const p of [{ wear: 'slow' }, { wear: 'fast' }, { wear: 'accelerating' }, { power: 'reliable' }, { power: 'unscheduled' }, { floor: 'noisy' }, { seed: 7 }, { fault: 'aln', wear: 'fast', power: 'unscheduled', floor: 'noisy', seed: 42 }] as Partial<Setup>[]) {
  setActiveSetup({ ...DEFAULT_SETUP, ...p });
  const mm = getModel();
  check(`setup: ${JSON.stringify(p)}`, mm.post[0].id === FAULTS[mm.setup.fault].rule && !!mm.loom.rul, `${mm.loom.now.state} · P50 ${mm.loom.rul?.p50.toFixed(1)} d · ${mm.cost.best.id} ${inr(mm.cost.best.E)}`);
}
// every kind of shed: its hero is the machine that degrades, every fault is diagnosed as itself
for (const shed of SHED_IDS) {
  for (const fault of Object.keys(FAULTS) as (keyof typeof FAULTS)[]) {
    setActiveSetup({ ...DEFAULT_SETUP, shed, fault });
    const mm = getModel();
    check(`shed: ${shed} · ${fault}`, mm.loom.id === SHEDS[shed].hero && mm.machines.length === SHEDS[shed].machines.length && mm.post[0].id === FAULTS[fault].rule && !!mm.loom.rul && mm.cost.best.feasible && Math.abs(mm.measuredRpm - SHEDS[shed].rpm) < 6,
      `${mm.loom.name} · ${(mm.post[0].p * 100).toFixed(1)}% · ${mm.measuredRpm} rpm · P50 ${mm.loom.rul?.p50.toFixed(1)} d · ${mm.cost.best.id} ${inr(mm.cost.best.E)}`);
  }
}
// the order book scales only the lost margin; a phone never punches current or temperature,
// still diagnoses every fault as itself, and the default kit and orders leave the demo unchanged
{
  setActiveSetup(DEFAULT_SETUP);
  const base = getModel().cost;
  setActiveSetup({ ...DEFAULT_SETUP, orders: 'rush' });
  const rush = getModel().cost;
  setActiveSetup({ ...DEFAULT_SETUP, orders: 'slack' });
  const slack = getModel().cost;
  check('orders: rush raises and slack lowers the breakdown bill, wages unchanged', rush.unplanned > base.unplanned && slack.unplanned < base.unplanned && rush.wagesH === base.wagesH && rush.planned === base.planned,
    `slack ${inr(slack.unplanned)} · normal ${inr(base.unplanned)} · rush ${inr(rush.unplanned)}`);
  for (const fault of Object.keys(FAULTS) as (keyof typeof FAULTS)[]) {
    setActiveSetup({ ...DEFAULT_SETUP, kit: 'phone', fault });
    const mm = getModel();
    const blind = mm.machines.every((m) => m.cards.every((c) => !c.holes[6] && !c.holes[7]));
    check(`phone: ${fault} is diagnosed as ${FAULTS[fault].rule}, no current or temperature holes`, blind && mm.post[0].id === FAULTS[fault].rule && !!mm.loom.rul && !mm.evidence.some((e) => e.id === 'temp'),
      `${(mm.post[0].p * 100).toFixed(1)}% · ${mm.evidence.map((e) => e.id).join(', ')}`);
  }
}
setActiveSetup(DEFAULT_SETUP);

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall model checks passed');
