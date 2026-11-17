'use client';
// The agent run, streamed. Every step is a deterministic tool call; switches change the
// facts (a cancelled power cut, a dealer out of stock, a note set aside) and the agents
// re-plan in front of you. Outward actions wait at the owner's gate.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getModel } from '@/lib/model';
import { inr, pct } from '@/lib/model/core';
import { planRun, type Step } from '@/lib/agents/pipeline';
import type { Scenario } from '@/lib/model/decide';
import { useNaadi } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/hooks';
import { Icon, StatusIcon } from '@/components/shell/Icons';
import { CostWindows } from '@/components/decide/CostWindows';

const STEP_MS = 520;
const AGENT_MARK: Record<string, string> = { Sentinel: 'SE', Diagnostician: 'DI', 'Worker note': 'WN', Prognostician: 'PR', Procurement: 'PC', Planner: 'PL', Dispatcher: 'DS', Owner: 'OW' };

function summary(lang: string, p: number, when: string, expected: string, breakdown: string, rule: string) {
  if (lang === 'hi') return `लूम 03 की मोटर के ड्राइव-एंड बेयरिंग की आउटर रेस में खराबी की संभावना ${p}% है (${rule})। मरम्मत ${when} में करने पर अनुमानित ख़र्च ${expected} है, जबकि ख़राब होने तक चलाने पर ${breakdown}। आपकी मंज़ूरी के बिना कुछ नहीं भेजा जाएगा।`;
  if (lang === 'mr') return `लूम 03 च्या मोटरच्या ड्राइव्ह-एंड बेअरिंगच्या आउटर रेसमध्ये बिघाड असण्याची शक्यता ${p}% आहे (${rule}). दुरुस्ती ${when} मध्ये केल्यास अपेक्षित खर्च ${expected}; बंद पडेपर्यंत चालवल्यास ${breakdown}. तुमच्या मंजुरीशिवाय काहीही पाठवले जाणार नाही.`;
  return `Loom 03's motor drive-end bearing most likely has an outer-race defect (${p}%, rule ${rule}). Repairing in ${when} costs about ${expected}; running it to failure costs about ${breakdown}. Nothing is sent until you approve.`;
}

export function AgentConsole() {
  const model = getModel();
  const { scenario, setScenario, useNote, setUseNote, decision, decide } = useNaadi();
  const { lang, st } = useT();
  const reduced = useReducedMotion();
  const run = useMemo(() => planRun(model, { scenario, useNote, decision }), [model, scenario, useNote, decision]);
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const [change, setChange] = useState<string | null>(null);

  // stream steps one by one whenever a run starts
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n + 1 >= run.steps.length) { setRunning(false); return run.steps.length; }
        return n + 1;
      });
    }, reduced ? 60 : STEP_MS);
    return () => window.clearInterval(id);
  }, [running, run.steps.length, reduced]);

  const start = () => { setShown(1); setRunning(true); };
  // when the facts change: plan with the new facts first, say what changed, then re-run
  const rerun = (next: { scenario?: Partial<Scenario>; useNote?: boolean }) => {
    const sc = { ...scenario, ...next.scenario };
    const before = run.cost.best;
    const after = planRun(model, { scenario: sc, useNote: next.useNote ?? useNote, decision }).cost.best;
    setChange(before.id === after.id
      ? `Plan unchanged: ${after.when.split(',')[0]}, ${inr(after.E)}.`
      : `Plan changed: ${before.when.split(',')[0]} → ${after.when.split(',')[0]} (${inr(before.E)} → ${inr(after.E)}).`);
    if (next.scenario) setScenario(next.scenario);
    if (next.useNote !== undefined) setUseNote(next.useNote);
    setShown(1);
    setRunning(true);
  };

  const best = run.cost.best;
  const queue = ['L03', 'P02', 'L05'].map((id) => model.byId[id]);
  const steps = run.steps.slice(0, shown);
  const done = shown >= run.steps.length && !running;

  return (
    <section className="view-agents" aria-labelledby="agents-title">
      <div className="region agents-head">
        <div>
          <h1 id="agents-title">Agents prepare. The owner decides.</h1>
          <p className="sub">Seven roles, each allowed only certain tools. Every number below comes from a deterministic tool; the agents choose the next call and write the drafts. Change the facts on the right and watch them re-plan.</p>
        </div>
        <div className="agents-badges">
          <span className="badge"><b className="mono">{run.steps.filter((s) => s.kind !== 'human').length}</b> tool calls</span>
          <span className="badge"><b className="mono">0</b> numbers made up by a language model</span>
          <span className="badge"><b className="mono">2</b> outward actions held at the gate</span>
        </div>
      </div>

      <div className="agents-grid">
        <aside className="region agents-queue">
          <h2>Queue</h2>
          <p className="sub">Ranked by what waiting could cost.</p>
          <ol className="queue">
            {queue.map((m) => (
              <li key={m.id} className={m.id === 'L03' ? 'is-on' : ''}>
                <StatusIcon state={m.now.state} />
                <div>
                  <strong>{m.name}</strong>
                  <span>{m.id === 'L03' ? `${model.post[0].name} · ${inr(run.cost.saving)} at stake` : `${m.prof!.label} · watch only`}</span>
                </div>
                <Link className="link" href={`/machine/${m.id}`} aria-label={`Open ${m.name}'s record`}><Icon name="right" /></Link>
              </li>
            ))}
          </ol>
          <p className="fine">Pump 2 and Loom 05 are at watch: the agents note their actions but propose nothing outward.</p>
        </aside>

        <div className="region agents-run">
          <div className="region-head">
            <div><h2>The run for Loom 03</h2><p className="sub">{done ? `${run.steps.length} steps · ${st('act')} · ${best.when}` : running ? 'Running…' : 'Press run to watch each agent call its tools.'}</p></div>
            <button type="button" className="btn primary" onClick={start} disabled={running}><Icon name="play" />{shown ? 'Run the agents again' : 'Run the agents'}</button>
          </div>
          {change && <p className="plan-change step-in" role="status">{change}</p>}
          <ol className="steps">
            {steps.map((s, i) => <StepCard key={s.id + i} s={s} live={running && i === steps.length - 1} />)}
            {!shown && <li className="steps-empty">Nothing has run yet.</li>}
          </ol>
        </div>

        <aside className="region agents-side">
          <h2>What if…</h2>
          <p className="sub">Change a fact; the run starts again with it.</p>
          <div className="switches">
            <Switch label="Thursday's power cut is on" detail="The loom is idle 14:00–18:00 anyway" on={scenario.powerCut} onChange={(v) => rerun({ scenario: { powerCut: v } })} />
            <Switch label="The dealer has 6205-2RS in stock" detail="Otherwise the second dealer needs 3 days" on={scenario.partInStock} onChange={(v) => rerun({ scenario: { partInStock: v } })} />
            <Switch label="Count Sunita's voice note" detail="Weak evidence: likelihood ratio 1.8" on={useNote} onChange={(v) => rerun({ useNote: v })} />
          </div>
          <h3>Repair windows</h3>
          <CostWindows cost={run.cost} compact />
          <h3>Outbox</h3>
          <div className="draft">
            <div className="draft-head"><Icon name="message" /> WhatsApp to {scenario.partInStock ? 'Laxmi Bearing House' : 'Shree Bearings, Kolhapur'} <span>{decision === 'approved' ? 'Ready to send' : 'Held'}</span></div>
            <p>“Namaskar. Need 2 × 6205-2RS bearings by {best.id === 'sun' ? 'Saturday evening' : 'Thursday 12:00'} for Shed 2, Ichalkaranji. Please confirm stock and rate.”</p>
          </div>
          <div className="draft">
            <div className="draft-head"><Icon name="person" /> Ramesh Patil, technician <span>{decision === 'approved' ? 'Booked' : 'Held'}</span></div>
            <p>{best.when} held for Loom 03.</p>
          </div>
          <h3>For the owner</h3>
          <p className="owner-note" lang={lang}>{summary(lang, Math.round(run.post[0].p * 1000) / 10, best.when.split(',')[0], inr(best.E), inr(run.cost.unplanned), run.post[0].id)}</p>
          <div className="actions">
            {decision === 'approved' ? (
              <><span className="done"><Icon name="check" /> Approved</span><button type="button" className="btn-quiet" onClick={() => decide('open')}>Undo</button></>
            ) : (
              <><button type="button" className="btn primary" onClick={() => decide('approved')}>Approve repair</button><button type="button" className="btn" onClick={() => decide('snoozed')}>Not now</button></>
            )}
          </div>
          <p className="fine">Risk of failing before {best.when.split(',')[0]}: {pct(best.F)}. The summary is written from the computed facts; with an API key configured, a language model may phrase it, but never changes a number.</p>
        </aside>
      </div>
    </section>
  );
}

function StepCard({ s, live }: { s: Step; live: boolean }) {
  return (
    <li className={`step step--${s.kind}${s.waiting ? ' is-wait' : ''} step-in`}>
      <span className="step-mark mono" aria-hidden="true">{AGENT_MARK[s.agent]}</span>
      <div className="step-body">
        <div className="step-top"><strong>{s.agent}</strong><span className="mono">{s.at}</span>{s.kind === 'gate' && <span className="gate">Owner gate</span>}</div>
        <code>{s.call}</code>
        <p>{live ? 'Calling…' : s.result}</p>
        {s.cites && !live && <div className="cites">{s.cites.map((c) => <span key={c} className="mono">{c}</span>)}</div>}
      </div>
    </li>
  );
}

function Switch({ label, detail, on, onChange }: { label: string; detail: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="switch" onClick={() => onChange(!on)}>
      <span className="switch-track" aria-hidden="true"><i /></span>
      <span><strong>{label}</strong><span>{detail}</span></span>
    </button>
  );
}
