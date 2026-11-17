'use client';
// React host for the 3D agents. Each agent carries an HTML label pinned above it: its mark and
// name, and while it acts, the call it is making. The gate's Approve sits on the gate itself.
import { useEffect, useRef, useState } from 'react';
import type { AgentAnchors, AgentId, AgentsEngine } from '@/lib/agents3d/engine';
import { AGENTS } from '@/lib/agents3d/engine';
import { useReducedMotion } from '@/lib/hooks';

interface Props {
  active: AgentId | null;
  from: AgentId | null;
  /** agents that have finished a call in this run */
  done: AgentId[];
  /** the call the active agent is making */
  call?: string;
  /** a new run: clear the plinths */
  runKey: number;
  gateShut: boolean;
  onApprove?: () => void;
}

export function AgentStage({ active, from, done, call, runKey, gateShut, onApprove }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<AgentsEngine | null>(null);
  const tags = useRef<Partial<Record<AgentId, HTMLDivElement | null>>>({});
  const gate = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    let made: AgentsEngine | null = null;
    (async () => {
      try {
        const { AgentsEngine } = await import('@/lib/agents3d/engine');
        if (cancelled || !host.current) return;
        made = new AgentsEngine(host.current, {
          reducedMotion: reduced,
          onAnchors: (a: AgentAnchors) => {
            for (const id of Object.keys(a.agents) as AgentId[]) {
              const el = tags.current[id];
              if (el) el.style.transform = `translate(${Math.round(a.agents[id].x)}px, ${Math.round(a.agents[id].y)}px)`;
            }
            if (gate.current) gate.current.style.transform = `translate(${Math.round(a.gate.x)}px, ${Math.round(a.gate.y)}px)`;
          },
        });
        engine.current = made;
        setStatus('ready');
      } catch (err) {
        console.error('3D agents unavailable:', err);
        if (!cancelled) setStatus('failed');
      }
    })();
    return () => { cancelled = true; made?.dispose(); engine.current = null; };
    // built once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { engine.current?.reset(); }, [runKey, status]);
  useEffect(() => { engine.current?.setActive(active, from); }, [active, from, status]);
  useEffect(() => { engine.current?.setGate(!gateShut); }, [gateShut, status]);

  return (
    <div className="agent-stage" role="img" aria-label="Seven agents and the owner on point paper, joined by the handoffs between them; during a run a punched card travels each handoff">
      <div ref={host} className="agent-stage-gl" />
      <div className="agent-tags" aria-hidden="true">
        {AGENTS.map((a) => (
          <div key={a.id} ref={(el) => { tags.current[a.id] = el; }} className={`agent-tag${a.id === active ? ' is-on' : done.includes(a.id) ? ' is-done' : ''}`}>
            <span className="agent-tag-in">
              <b className="mono">{a.id}</b>{a.name}
              {a.id === active && call && <code>{call}</code>}
            </span>
          </div>
        ))}
      </div>
      <div ref={gate} className="agent-gate">
        <span className="agent-gate-in">
          {gateShut
            ? <>{onApprove && <button type="button" className="btn primary" onClick={onApprove}>Approve repair</button>}<em>Owner&apos;s gate · 2 drafts held</em></>
            : <em>Owner&apos;s gate · open</em>}
        </span>
      </div>
      {status === 'loading' && <p className="reader-note" role="status">Bringing the agents in…</p>}
      {status === 'failed' && <p className="reader-note">The 3D agents need WebGL. The tape beside them carries every call and result.</p>}
    </div>
  );
}
