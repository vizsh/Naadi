'use client';
// The model card: a simulation study of NAADI's maths, run in this tab. Bearings with random
// onsets and wear rates run to failure; healthy machines run for months. Every forecast is
// made only from the cards seen at the time, and is then scored against what happened.
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createStudy, STUDY_DEFAULTS, type FaultyRun, type StudyOptions, type StudyResult } from '@/lib/model/study';
import { FORECAST } from '@/lib/model/shed';
import { inr, pct } from '@/lib/model/core';
import { useWidth } from '@/lib/hooks';
import { hideTip, tipAt } from '@/lib/store';
import { Icon } from '@/components/shell/Icons';
import { Switch } from '@/components/shell/Switch';

const GRID = 'rgba(64,108,98,.11)', GRID_B = 'rgba(64,108,98,.26)';
const r2 = (v: number) => Math.round(v * 100) / 100;

export function ModelCard() {
  const [opts, setOpts] = useState<StudyOptions>(STUDY_DEFAULTS);
  const [res, setRes] = useState<StudyResult | null>(null);
  const [progress, setProgress] = useState(0);
  // run the study in small slices so the page stays responsive
  useEffect(() => {
    let cancelled = false;
    const s = createStudy(opts);
    let timer = 0;
    const tick = () => {
      if (cancelled) return;
      const done = s.step(28);
      setProgress(s.progress);
      if (done) setRes(s.result());
      else timer = window.setTimeout(tick, 0);
    };
    timer = window.setTimeout(tick, 30);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [opts]);
  const running = !res || res.opts !== opts;
  const set = (p: Partial<StudyOptions>) => setOpts((o) => ({ ...o, ...p }));

  return (
    <section className="view-model" aria-labelledby="model-title">
      <div className="region model-head">
        <div>
          <h1 id="model-title">Model card: how far to trust the numbers</h1>
          <p className="sub">A simulation study of NAADI&apos;s maths, run in this tab. {opts.faulty} bearings start wearing at random times and rates and run until they fail; {opts.healthy} healthy machines run for {opts.months} months each. Every forecast below was made only from the cards seen at that moment, then scored against what happened.</p>
          <p className="fine">The bearings come from the same generative model as the demo shed, so this tests that the pipeline is consistent and calibrated when its assumptions hold, and shows where it breaks when they do not. It is not field accuracy; that protocol is at the foot of the page.</p>
        </div>
        <div className="model-controls">
          <Switch label="Wear accelerates" detail="Growth speeds up; the forecast still assumes a constant rate" on={opts.accelerate} onChange={(v) => set({ accelerate: v })} />
          <Switch label="Model-form prior" detail={`±${Math.round((opts.method === 'first' ? 0.25 : FORECAST.prior) * 100)}% on the growth rate, on top of the fit's own error`} on={opts.prior} onChange={(v) => set({ prior: v })} />
          <Switch label="The first version's forecast" detail="Fit from the change point, before this study fixed it" on={opts.method === 'first'} onChange={(v) => set({ method: v ? 'first' : 'current' })} />
          <div className="actions">
            <button type="button" className="btn" onClick={() => set({ seed: opts.seed + 1 })} disabled={running}><Icon name="play" />New bearings</button>
            <button type="button" className="btn-quiet" onClick={() => setOpts(STUDY_DEFAULTS)} disabled={opts === STUDY_DEFAULTS}>Reset</button>
            <span className="mono model-seed">seed {opts.seed}</span>
          </div>
        </div>
        <div className={`model-badges${running ? ' is-running' : ''}`} aria-live="polite">
          {running ? (
            <span className="badge">Simulating… <b className="mono">{Math.round(progress * 100)}%</b></span>
          ) : res && (
            <>
              <span className="badge"><b className="mono">{pct(res.detected)}</b> of faults detected before failure</span>
              <span className="badge"><b className="mono">{res.lead.p50.toFixed(1)} d</b> median warning</span>
              <span className="badge"><b className="mono">{pct(res.coverage.all)}</b> of failures inside P10–P90 (aim 80%)</span>
              <span className="badge"><b className="mono">{res.falseAlarms}</b> false alarms in {res.healthyMonths} machine-months</span>
              <span className="badge"><b className="mono">{inr(res.costs.policy)}</b> per bearing, against {inr(res.costs.rtf)}</span>
            </>
          )}
        </div>
      </div>

      {res && (
        <div className={`model-grid${running ? ' is-stale' : ''}`}>
          <div className="region mc-calib">
            <h2>Is the forecast honest?</h2>
            <p className="sub">Where each real failure fell within the forecast that came before it, in tenths. An honest forecast fills every tenth about equally, so each bar sits near the dashed line.</p>
            <PitChart res={res} />
            <dl className="mc-stats">
              <div><dt>Inside P10–P90</dt><dd className="mono">{pct(res.coverage.all)}</dd><dd>of {res.coverage.n.toLocaleString('en-IN')} forecasts; 80% is the aim</dd></div>
              <div><dt>Failed before P10</dt><dd className="mono">{pct(res.early10)}</dd><dd>the dangerous side; 10% is honest</dd></div>
              <div><dt>Failed after P90</dt><dd className="mono">{pct(res.late90)}</dd><dd>forecast too early; parts changed sooner than needed</dd></div>
              <div><dt>First two days after detection</dt><dd className="mono">{pct(res.coverage.early)}</dd><dd>inside P10–P90, when the fit has the fewest cards</dd></div>
            </dl>
            <p className="mc-read">{reading(res)}</p>
          </div>

          <div className="region mc-runs">
            <h2>Forecast against what happened</h2>
            <p className="sub">Three of the bearings. Each bar is the P10–P90 forecast made that day; the line is the time that was really left.</p>
            <RunsChart runs={res.runs} />
          </div>

          <div className="region mc-detect">
            <h2>How much warning</h2>
            <p className="sub">Days between the card where Page–Hinkley flagged a change and the failure. One cell per bearing.</p>
            <LeadChart res={res} />
          </div>

          <div className="region mc-policy">
            <h2>What it saves</h2>
            <p className="sub">At each bearing&apos;s first act card, the planner books the next Sunday unless the chance of failing first is over 10%; then it stops at the next shift change. One cell per bearing.</p>
            <PolicyCells res={res} />
          </div>

          <div className="region mc-false">
            <h2>False alarms</h2>
            <p className="big mono">{res.falseAlarms}</p>
            <p className="sub">change points flagged in {res.healthyMonths} machine-months of healthy running, and {res.watchOnHealthy} cards at watch or act. Page–Hinkley ignores drifts under δ = 0.05 in log degradation and needs a rise of λ = 0.8 before it speaks.</p>
          </div>

          <div className="region mc-limits">
            <h2>What this study changed</h2>
            <p>The first version fitted the growth rate from the change point itself, so its fit included the jump out of normal. Its forecasts came too early: switch on <em>The first version&apos;s forecast</em> to see about a fifth of failures land after P90, and coverage in the first two days fall below 10%. The forecast now starts at the first card clear of the machine&apos;s normal band (mean + 3 sd), waits two cards for the smoothing to settle, widens the fit&apos;s error by √3 because smoothed cards are correlated, and keeps a ±15% prior on how wear accelerates.</p>
            <h3>Known limits</h3>
            <ul className="limits">
              <li><b>Accelerating wear.</b> A constant-rate forecast is late when wear speeds up: switch it on and most failures land before P10. The act threshold and the 10% rule are the guard; a curvature term is on the roadmap.</li>
              <li><b>One fault at a time.</b> Each simulated bearing has a single outer-race defect on a steady load; real sheds change load and stack faults.</li>
              <li><b>Synthetic signals.</b> Degradation here is the model&apos;s own index, not a measured envelope. The protocol below replaces it with recorded bearings.</li>
            </ul>
          </div>

          <div className="region mc-public">
            <h2>On public data: the protocol, not yet run</h2>
            <p className="sub">The same pipeline, scored on recordings from real machines. None of these have been run in this build, so no numbers are claimed for them.</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Dataset</th><th>What it holds</th><th>What NAADI would report</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>NASA IMS bearings</td><td>Run-to-failure vibration of four bearings on one shaft, 1-second snapshots every 10 minutes</td><td>Warning time from the change point; P10–P90 coverage of time to failure, as above</td><td>Pending</td></tr>
                  <tr><td>CWRU bearing data</td><td>Seeded inner-race, outer-race and ball faults at four loads, 12 and 48 kHz</td><td>Envelope peak at the right defect tone; confusion between BPFO and BPFI rules</td><td>Pending</td></tr>
                  <tr><td>MIMII</td><td>Normal and anomalous sound of fans, pumps, slide rails and valves, with factory noise</td><td>Area under the ROC curve of the Live Lab&apos;s Mahalanobis score per machine</td><td>Pending</td></tr>
                </tbody>
              </table>
            </div>
            <p className="fine">Method notes are in <Link href="https://github.com/vizsh/Naadi/blob/main/docs/11-model-card.md">docs/11</Link>. Everything on this page is computed by <code>src/lib/model/study.ts</code> from seed {res.opts.seed}.</p>
          </div>
        </div>
      )}
    </section>
  );
}

/** What the calibration chart says, in one sentence, from the numbers themselves. */
function reading(res: StudyResult) {
  const { all } = res.coverage;
  if (res.early10 > 0.3) return `Read it as: the forecast is late. ${pct(res.early10)} of failures came before P10, the side that turns a planned repair into a breakdown.`;
  if (res.late90 > 0.15) return `Read it as: the forecast is early. ${pct(res.late90)} of failures came after P90, so parts would be changed sooner than needed.`;
  if (all > 0.84) return `Read it as: honest on the dangerous side (${pct(res.early10)} before P10, against 10%) and a little wide in the middle, so the bands are conservative: they cost some early replacement, not breakdowns.`;
  if (all < 0.72) return `Read it as: overconfident. Too many failures fall outside P10–P90 for the bands to be trusted as written.`;
  return `Read it as: calibrated. The bands hold about as many failures as they claim.`;
}

function PitChart({ res }: { res: StudyResult }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 560;
  const H = 220, m = { l: 40, r: 12, t: 16, b: 40 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const total = res.pitBins.reduce((s, v) => s + v, 0) || 1;
  const shares = res.pitBins.map((v) => v / total);
  const top = Math.max(0.3, ...shares) * 1.08;
  const Y = (v: number) => r2(m.t + ph - (v / top) * ph);
  const bw = pw / 10;
  return (
    <div className="chart" ref={wrap}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Histogram of where failures fell in their forecasts" onPointerLeave={hideTip}>
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5].filter((v) => v <= top).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={m.l + pw} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? GRID_B : GRID} />
            <text x={m.l - 6} y={Y(v) + 4} className="t-num" textAnchor="end">{Math.round(v * 100)}%</text>
          </g>
        ))}
        {shares.map((v, i) => (
          <rect key={i} x={r2(m.l + i * bw + 2)} y={Y(v)} width={r2(bw - 4)} height={r2(Y(0) - Y(v))}
            fill={i === 0 ? 'var(--act)' : i === 9 ? 'var(--ink-3)' : 'var(--ink)'}
            onPointerMove={(e) => tipAt(e, `${pct(v)} of failures`, [i === 0 ? 'before P10: the forecast was too late' : i === 9 ? 'after P90: the forecast was too early' : `between P${i * 10} and P${i * 10 + 10}`])} />
        ))}
        <line x1={m.l} x2={m.l + pw} y1={Y(0.1)} y2={Y(0.1)} stroke="var(--ink)" strokeDasharray="4 3" />
        <text x={m.l + pw} y={Y(0.1) - 6} className="t-cap" textAnchor="end">honest: 10% each</text>
        {['P10', 'P20', 'P30', 'P40', 'P50', 'P60', 'P70', 'P80', 'P90'].map((l, i) => <text key={l} x={r2(m.l + (i + 1) * bw)} y={m.t + ph + 15} className="t-num" textAnchor="middle">{l}</text>)}
        <text x={m.l} y={H - 4} className="t-cap">← failed earlier than forecast</text>
        <text x={m.l + pw} y={H - 4} className="t-cap" textAnchor="end">failed later →</text>
      </svg>
    </div>
  );
}

function RunsChart({ runs }: { runs: FaultyRun[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 900;
  const pick = useMemo(() => runs.filter((r) => r.checks.length >= 6).slice(0, 3), [runs]);
  const cols = W < 700 ? 1 : pick.length || 1, gap = 24;
  const cw = Math.floor((W - gap * (cols - 1)) / cols), H = 240, m = { l: 34, r: 8, t: 18, b: 38 };
  return (
    <div className="chart mc-runs-row" ref={wrap}>
      {pick.map((run) => {
        const pw = cw - m.l - m.r, ph = H - m.t - m.b;
        const xMax = Math.max(4, Math.ceil((run.lead ?? 1) + 0.5));
        const yMax = Math.max(4, Math.ceil(Math.max(run.lead ?? 1, ...run.checks.map((c) => Math.min(c.p90, 60))) / 2) * 2);
        const X = (d: number) => r2(m.l + (d / xMax) * pw);
        const Y = (d: number) => r2(m.t + ph - (Math.min(d, yMax) / yMax) * ph);
        const lead = run.lead ?? 0;
        return (
          <svg key={run.id} width={r2(cw)} height={H} viewBox={`0 0 ${r2(cw)} ${H}`} role="img" aria-label={`Bearing ${run.id + 1}: forecasts against the real time left`} onPointerLeave={hideTip}>
            {Array.from({ length: Math.floor(yMax / 2) + 1 }, (_, i) => i * 2).map((d) => (
              <g key={d}>
                <line x1={m.l} x2={m.l + pw} y1={Y(d)} y2={Y(d)} stroke={d % 10 ? GRID : GRID_B} />
                {d % 4 === 0 && d < yMax && <text x={m.l - 5} y={Y(d) + 4} className="t-num" textAnchor="end">{d}</text>}
              </g>
            ))}
            <line x1={X(0)} x2={X(lead)} y1={Y(lead)} y2={Y(0)} stroke="var(--ink)" strokeWidth="1.5" />
            {run.checks.map((c) => (
              <g key={c.k} onPointerMove={(e) => tipAt(e, `Day ${c.age.toFixed(1)} after detection`, [`Forecast P10 ${c.p10.toFixed(1)} · P50 ${c.p50.toFixed(1)} · P90 ${c.p90.toFixed(1)} d`, `Really left: ${c.remaining.toFixed(1)} d`])}>
                <rect x={X(c.age) - 6} y={m.t} width="12" height={ph} fill="transparent" />
                <line x1={X(c.age)} x2={X(c.age)} y1={Y(c.p10)} y2={Y(c.p90)} stroke={c.pit <= 0.1 ? 'var(--act)' : 'var(--ink-3)'} strokeWidth="5" />
                <rect x={X(c.age) - 3} y={Y(c.p50) - 1} width="6" height="2" fill="var(--paper-hi)" />
              </g>
            ))}
            {Array.from({ length: Math.floor(xMax / 2) + 1 }, (_, i) => i * 2).map((d) => <text key={d} x={X(d)} y={m.t + ph + 15} className="t-num" textAnchor="middle">{d}</text>)}
            <text x={m.l + pw} y={H - 2} className="t-cap" textAnchor="end">days after the change was detected</text>
            <text x={m.l - 5} y={m.t + 4} className="t-cap" textAnchor="end">d left</text>
            <text x={m.l + pw} y={m.t + 10} className="t-cap" textAnchor="end">bearing {run.id + 1} · {lead.toFixed(1)} days of warning</text>
          </svg>
        );
      })}
    </div>
  );
}

function LeadChart({ res }: { res: StudyResult }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 560;
  const leads = res.runs.map((r) => r.lead).filter((l): l is number => l !== null && l > 0);
  const maxD = Math.max(20, Math.ceil(Math.max(...leads, 0) / 5) * 5);
  const bins = Array.from({ length: maxD }, () => 0);
  for (const l of leads) bins[Math.min(maxD - 1, Math.floor(l))]++;
  const m = { l: 8, r: 8, t: 10, b: 34 };
  const pw = W - m.l - m.r;
  const pitch = Math.max(3, Math.floor(pw / maxD));
  const cell = Math.max(2, pitch - 1);
  const rows = Math.max(...bins, 1);
  const H = m.t + rows * (cell + 1) + m.b;
  const X = (d: number) => r2(m.l + d * pitch);
  return (
    <div className="chart" ref={wrap}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Days of warning before failure, one cell per bearing">
        {bins.map((c, d) => Array.from({ length: c }, (_, j) => (
          <rect key={`${d}-${j}`} x={X(d)} y={r2(m.t + (rows - 1 - j) * (cell + 1))} width={cell} height={cell} fill="var(--ink)" />
        )))}
        <line x1={m.l} x2={m.l + maxD * pitch} y1={m.t + rows * (cell + 1) + 2} y2={m.t + rows * (cell + 1) + 2} stroke={GRID_B} />
        {Array.from({ length: maxD / 5 + 1 }, (_, i) => i * 5).map((d) => <text key={d} x={X(d)} y={m.t + rows * (cell + 1) + 16} className="t-num" textAnchor="middle">{d}</text>)}
        <line x1={X(res.lead.p50)} x2={X(res.lead.p50)} y1={m.t} y2={m.t + rows * (cell + 1)} stroke="var(--paper-hi)" strokeWidth="3" />
        <line x1={X(res.lead.p50)} x2={X(res.lead.p50)} y1={m.t} y2={m.t + rows * (cell + 1)} stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 2" />
        <text x={X(res.lead.p50) + 4} y={m.t + 9} className="t-cap">median {res.lead.p50.toFixed(1)} d</text>
        <text x={m.l + maxD * pitch} y={H - 4} className="t-cap" textAnchor="end">days of warning · shortest {res.lead.min.toFixed(1)} d · P10 {res.lead.p10.toFixed(1)} d</text>
      </svg>
    </div>
  );
}

function PolicyCells({ res }: { res: StudyResult }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 560;
  const per = Math.max(10, Math.min(40, Math.floor(W / 14)));
  const pitch = Math.floor(W / per), cell = pitch - 2;
  const rows = Math.ceil(res.runs.length / per);
  const H = rows * pitch;
  const fill = { sunday: '#E2E6DD', now: 'var(--watch)', breakdown: 'var(--act)' } as const;
  return (
    <>
      <div className="chart" ref={wrap}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Outcome of the repair policy for every simulated bearing" onPointerLeave={hideTip}>
          {res.runs.map((r, i) => (
            <rect key={r.id} x={(i % per) * pitch} y={Math.floor(i / per) * pitch} width={cell} height={cell} fill={fill[r.outcome]}
              onPointerMove={(e) => tipAt(e, r.outcome === 'sunday' ? 'Repaired on a Sunday' : r.outcome === 'now' ? 'Stopped at the next shift change' : 'Broke down first', [`Bearing ${r.id + 1}: ${r.lead?.toFixed(1) ?? '–'} d of warning`, inr(r.cost)])} />
          ))}
        </svg>
      </div>
      <ul className="legend mc-legend">
        <li><svg className="sw" viewBox="0 0 10 10"><rect width="10" height="10" fill="#E2E6DD" /></svg>Sunday, no output lost · {res.costs.sunday}</li>
        <li><svg className="sw" viewBox="0 0 10 10"><rect width="10" height="10" fill="var(--watch)" /></svg>Stopped early, 4 h lost · {res.costs.now}</li>
        <li><svg className="sw" viewBox="0 0 10 10"><rect width="10" height="10" fill="var(--act)" /></svg>Broke down first · {res.costs.breakdown}</li>
      </ul>
      <p className="mc-money"><b className="mono">{inr(res.costs.policy)}</b> per bearing on average, against <b className="mono">{inr(res.costs.rtf)}</b> when each one runs to failure: <b className="mono">{inr(res.costs.saving)}</b> saved per bearing, at this shed&apos;s prices.</p>
    </>
  );
}
