// Model checks: asserts the invariants the UI relies on and prints the numbers the docs quote.
//   npm run test:model
import { getModel, costs, posterior, defectFactors, cursorFit, ALL_EVIDENCE, N_PAST, inr, pct } from '../src/lib/model';

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

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall model checks passed');
