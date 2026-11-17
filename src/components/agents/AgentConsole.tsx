'use client';
// The agent run, live. Seven agents stand in 3D where their jobs are; a punched card travels
// each handoff, the acting agent rises, and the tape prints what each call read and returned,
// on the run's clock. Switches change the facts and the agents re-plan in front of you. The
// owner's gate holds every outward draft until the owner approves.
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getModel } from '@/lib/model';
import { inr, pct } from '@/lib/model/core';
import { planRun, type Step } from '@/lib/agents/pipeline';
import { OWNER_WAITING, runCards, type StepCard } from '@/lib/agents/cards';
import type { Scenario } from '@/lib/model/decide';
import { useNaadi } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/hooks';
import { Icon, StatusIcon } from '@/components/shell/Icons';
import { CostWindows } from '@/components/decide/CostWindows';
import { Switch } from '@/components/shell/Switch';
import { AgentStage } from './AgentStage';
import type { AgentId } from '@/lib/agents3d/engine';
import { OwnerNote } from './OwnerNote';
import { activeBearing, activeFault, activeShed, heroId, heroName } from '@/lib/model/setup';
import { DecisionLog } from '@/components/decide/DecisionLog';

const MARK: Record<string, string> = { Sentinel: 'SE', Diagnostician: 'DI', 'Worker note': 'WN', Prognostician: 'PR', Procurement: 'PC', Planner: 'PL', Dispatcher: 'DS', Owner: 'OW' };
const READ_MS = 420, CHUNK = 3, TICK_MS = 20, SETTLE_MS = 300;
const fnOf = (call: string) => call.split('(')[0].split(' ·')[0];

export function AgentConsole() {
  const model = getModel();
  const { scenario, setScenario, useNote, setUseNote, decision, decide } = useNaadi();
  const { lang, st } = useT();
  const reduced = useReducedMotion();
  const run = useMemo(() => planRun(model, { scenario, useNote, decision }), [model, scenario, useNote, decision]);
  const steps = run.steps;
  const cards = useMemo<StepCard[]>(() => {
    const c = runCards(model, { scenario, useNote, decision }, run);
    return decision === 'approved' ? c : [...c, OWNER_WAITING];
  }, [model, scenario, useNote, decision, run]);
  const [cursor, setCursor] = useState(-1);
  const [typed, setTyped] = useState(0);
  const [running, setRunning] = useState(false);
  const [change, setChange] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const tape = useRef<HTMLOListElement>(null);

  // the run: feed a card, let the needles read it, type its result, move on
  useEffect(() => {
    if (!running || cursor >= steps.length) return;
    const full = steps[cursor].result.length;
    const last = cursor + 1 >= steps.length;
    const id = window.setTimeout(() => {
      if (typed >= full) { setCursor((c) => c + 1); setTyped(0); if (last) setRunning(false); }
      else setTyped((t) => Math.min(full, t + CHUNK));
    }, typed === 0 ? READ_MS : typed >= full ? SETTLE_MS : TICK_MS);
    return () => window.clearTimeout(id);
  }, [running, cursor, typed, steps]);

  // keep the newest line in view inside the tape (never the page)
  useEffect(() => { const t = tape.current; if (t) t.scrollTop = t.scrollHeight; }, [cursor, typed]);

  const start = () => {
    setChange(null);
    if (reduced) { setCursor(steps.length); setTyped(0); return; }
    setRunKey((n) => n + 1); setCursor(0); setTyped(0); setRunning(true);
  };
  const finishNow = () => { setRunning(false); setCursor(steps.length); setTyped(0); };
  // when the facts change: plan with the new facts first, say what changed, then read again
  const rerun = (next: { scenario?: Partial<Scenario>; useNote?: boolean }) => {
    const sc = { ...scenario, ...next.scenario };
    const before = run.cost.best;
    const after = planRun(model, { scenario: sc, useNote: next.useNote ?? useNote, decision }).cost.best;
    setChange(before.id === after.id
      ? `Plan unchanged: ${after.when.split(',')[0]}, ${inr(after.E)}.`
      : `Plan changed: ${before.when.split(',')[0]} → ${after.when.split(',')[0]} (${inr(before.E)} → ${inr(after.E)}).`);
    if (next.scenario) setScenario(next.scenario);
    if (next.useNote !== undefined) setUseNote(next.useNote);
    if (reduced) { setCursor(steps.length); return; }
    setRunKey((n) => n + 1); setCursor(0); setTyped(0); setRunning(true);
  };
  // approving after the run reads the owner's card next; the effect picks it up
  const approve = () => { decide('approved'); if (cursor >= steps.length && !reduced) setRunning(true); };

  const started = cursor >= 0;
  const active = running && cursor < steps.length;
  const latched = started && !active && cursor >= steps.length && decision !== 'approved';
  const best = run.cost.best;
  const queue = [heroId(), ...Object.keys(activeShed().others)].map((id) => model.byId[id]).filter(Boolean);
  const current: Step | undefined = steps[Math.min(cursor, steps.length - 1)];

  return (
    <section className="view-agents" aria-labelledby="agents-title">
      <div className="region agents-head">
        <div>
          <h1 id="agents-title">Agents prepare. The owner decides.</h1>
          <p className="sub">Seven roles, each allowed only certain tools. Each agent stands where its job is. Press Run and a punched card travels every handoff: the agent that acts rises, its call prints on the tape with what it read and returned. Nothing leaves the shed until the owner opens the gate.</p>
        </div>
        <div className="agents-badges">
          <span className="badge"><b className="mono">{steps.filter((s) => s.kind !== 'human').length}</b> tool calls</span>
          <span className="badge"><b className="mono">0</b> numbers made up by a language model</span>
          <span className="badge"><b className="mono">2</b> outward actions held at the gate</span>
        </div>
      </div>

      <div className="region agents-reader">
        <div className="region-head">
          <div>
            <h2>The run for {heroName()}</h2>
            <p className="sub">{!started ? 'Press Run and watch the work move from agent to agent.' : active ? `${steps[Math.min(cursor, steps.length - 1)].agent} is calling ${fnOf(steps[Math.min(cursor, steps.length - 1)].call)} · ${Math.min(cursor + 1, steps.length)} of ${steps.length}` : latched ? 'Every call made. The gate holds the drafts until you approve.' : `${steps.length} calls · ${st('act')} · ${best.when}`}</p>
          </div>
          <div className="run-controls">
            <span className="run-clock mono" aria-label="Run clock">{started && current ? current.at : '--:--:--'}</span>
            {active
              ? <button type="button" className="btn-quiet" onClick={finishNow}>Finish now</button>
              : <button type="button" className="btn primary" onClick={start}><Icon name="play" />{started ? 'Run again' : 'Run the agents'}</button>}
          </div>
        </div>
        {change && <p className="plan-change step-in" role="status">{change}</p>}
        <div className="reader-row">
          <AgentStage
            active={active ? (MARK[steps[cursor].agent] as AgentId) : null}
            from={active && cursor > 0 ? (MARK[steps[cursor - 1].agent] as AgentId) : null}
            done={started ? steps.slice(0, Math.min(cursor, steps.length)).map((x) => MARK[x.agent] as AgentId) : []}
            call={active ? fnOf(steps[cursor].call) : undefined}
            runKey={runKey}
            gateShut={decision !== 'approved'}
            onApprove={latched ? approve : undefined}
          />
          <ol className="tape" ref={tape} aria-live="polite">
            {!started && <li className="tape-empty">The tape is blank. Each call prints here as its agent acts: what it read, and what it returned.</li>}
            {started && steps.slice(0, Math.min(cursor + 1, steps.length)).map((s, i) => {
              const card = cards[i];
              const live = i === cursor && active;
              const text = live ? s.result.slice(0, typed) : s.result;
              const read = card ? card.positions.filter((p, j) => p && card.holes[j]) : [];
              return (
                <li key={s.id + i} className={`tape-line tape--${s.kind}${s.waiting ? ' is-wait' : ''}`}>
                  <span className="tape-at mono">{s.at}</span>
                  <span className="tape-mark mono" aria-hidden="true">{MARK[s.agent]}</span>
                  <div className="tape-body">
                    <p className="tape-call"><strong>{s.agent}</strong><code>{s.call}</code></p>
                    {card && <p className="tape-read">Read at {card.place}: {read.length ? read.join(' · ') : 'no holes'}</p>}
                    <p className="tape-result">{live && typed === 0 ? 'Reading…' : text}{live && typed > 0 && typed < s.result.length && <span className="caret" aria-hidden="true" />}</p>
                    {s.cites && !live && <div className="cites">{s.cites.map((c) => <span key={c} className="mono">{c}</span>)}</div>}
                  </div>
                </li>
              );
            })}
            {latched && (
              <li className="tape-line tape--latch">
                <span className="tape-at mono">--:--:--</span>
                <span className="tape-mark mono" aria-hidden="true">OW</span>
                <div className="tape-body">
                  <p className="tape-call"><strong>Owner&apos;s gate</strong></p>
                  <p className="tape-result">The WhatsApp to the dealer and the technician&apos;s hold are ready and held. Approve to release them to your phone; nothing is sent until you tap send there.</p>
                </div>
              </li>
            )}
          </ol>
        </div>
      </div>

      <div className="agents-grid">
        <aside className="region agents-queue">
          <h2>Queue</h2>
          <p className="sub">Ranked by what waiting could cost.</p>
          <ol className="queue">
            {queue.map((m) => (
              <li key={m.id} className={m.id === heroId() ? 'is-on' : ''}>
                <StatusIcon state={m.now.state} />
                <div>
                  <strong>{m.name}</strong>
                  <span>{m.id === heroId() ? `${model.post[0].name} · ${inr(run.cost.saving)} at stake` : `${m.prof!.label} · watch only`}</span>
                </div>
                <Link className="link" href={`/machine/${m.id}`} aria-label={`Open ${m.name}'s record`}><Icon name="right" /></Link>
              </li>
            ))}
          </ol>
          <p className="fine">Pump 2 and Loom 05 are at watch: the agents note their actions but propose nothing outward.</p>
        </aside>

        <div className="region agents-side">
          <h2>What if…</h2>
          <p className="sub">Change a fact; the agents run again with it, in front of you.</p>
          <div className="switches">
            <Switch label="Thursday's power cut is on" detail={`The ${activeShed().noun} is idle 14:00–18:00 anyway`} on={scenario.powerCut} onChange={(v) => rerun({ scenario: { powerCut: v } })} />
            <Switch label={`The dealer has ${activeFault().partShort} in stock`} detail="Otherwise the second dealer needs 3 days" on={scenario.partInStock} onChange={(v) => rerun({ scenario: { partInStock: v } })} />
            <Switch label={`Count ${activeShed().note.who.split(' ')[0]}'s voice note`} detail="Weak evidence: likelihood ratio 1.8" on={useNote} onChange={(v) => rerun({ useNote: v })} />
          </div>
          <h3>Repair windows</h3>
          <CostWindows cost={run.cost} compact />
          <p className="fine">Risk of failing before {best.when.split(',')[0]}: {pct(best.F)}.</p>
        </div>

        <div className="region agents-out">
          <h2>Outbox</h2>
          <div className="draft">
            <div className="draft-head"><Icon name="message" /> WhatsApp to {scenario.partInStock ? 'Laxmi Bearing House' : 'Shree Bearings, Kolhapur'} <span>{decision === 'approved' ? 'Ready to send' : 'Held'}</span></div>
            <p>“Namaskar. Need {activeFault().bearing ? `2 × ${activeBearing().name} bearings` : activeFault().part} by {best.id === 'sun' ? 'Saturday evening' : 'Thursday 12:00'} for {activeShed().place}. Please confirm stock and rate.”</p>
          </div>
          <div className="draft">
            <div className="draft-head"><Icon name="person" /> Ramesh Patil, technician <span>{decision === 'approved' ? 'Booked' : 'Held'}</span></div>
            <p>{best.when} held for {heroName()}.</p>
          </div>
          <h3>Decision log</h3>
          <DecisionLog />
          <h3>For the owner</h3>
          <OwnerNote input={{ lang, scenario, useNote, decision }} />
          <div className="actions">
            {decision === 'approved' ? (
              <><span className="done"><Icon name="check" /> Approved</span><button type="button" className="btn-quiet" onClick={() => decide('open')}>Undo</button></>
            ) : (
              <><button type="button" className="btn primary" onClick={approve}>Approve repair</button><button type="button" className="btn" onClick={() => decide('snoozed')}>Not now</button></>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
