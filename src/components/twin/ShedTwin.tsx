'use client';
// React host for the imperative twin engine: mounts once, forwards state, draws HTML overlays.
import { useEffect, useRef, useState } from 'react';
import type { Machine } from '@/lib/model/shed';
import type { CameraView, PartLabel, ShedEngine } from '@/lib/twin/engine';
import { getLabEngine, type LabCard } from '@/lib/lab/engine';
import { useReducedMotion } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { Icon, StatusIcon } from '@/components/shell/Icons';

interface Props {
  machines: Machine[];
  index: number;
  selected: string;
  shaftHz: number;
  onSelect: (id: string) => void;
  /** the Live Lab's machine is on the floor */
  live?: boolean;
  children?: React.ReactNode;
}

export function ShedTwin({ machines, index, selected, shaftHz, onSelect, live = false, children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<ShedEngine | null>(null);
  const reduced = useReducedMotion();
  const { st } = useT();
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cam, setCam] = useState<CameraView>('shed');
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [exploded, setExploded] = useState(false);
  const [labels, setLabels] = useState<PartLabel[]>([]);
  const selectRef = useRef(onSelect);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  // mount the engine once; three.js loads on demand so the page paints first
  useEffect(() => {
    let cancelled = false;
    let made: ShedEngine | null = null;
    (async () => {
      try {
        const { ShedEngine } = await import('@/lib/twin/engine');
        if (cancelled || !host.current) return;
        made = new ShedEngine(host.current, {
          machines,
          reducedMotion: reduced,
          onSelect: (id) => selectRef.current(id),
          onHover: (id) => {
            if (!id || !made) return setHover(null);
            const p = made.screenOf(id);
            if (p) setHover({ id, ...p });
          },
        });
        engine.current = made;
        if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __naadi: unknown }).__naadi = { engine: made };
        setStatus('ready');
      } catch (err) {
        console.error('3D shed unavailable:', err);
        if (!cancelled) setStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
      made?.dispose();
      engine.current = null;
    };
    // the engine is built once per mount; later state flows through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { engine.current?.setIndex(index); }, [index, status]);
  // open on the whole shed; fly only when the selection changes after the engine is ready
  const shownSel = useRef<string | null>(null);
  useEffect(() => {
    if (status !== 'ready' || !engine.current) return;
    engine.current.select(selected, shownSel.current !== null && shownSel.current !== selected);
    shownSel.current = selected;
  }, [selected, status]);
  useEffect(() => { engine.current?.setShaftHz(shaftHz); }, [shaftHz, status]);
  // the Live Lab's fan: shown while it is on the floor, its chain fed card by card
  useEffect(() => {
    const e = engine.current;
    if (status !== 'ready' || !e) return;
    e.setLive(live);
    if (!live) return;
    const lab = getLabEngine();
    let last: LabCard[] | null = null;
    const push = () => { if (lab.snap.cards !== last) { last = lab.snap.cards; e.setLiveCards(last); } };
    push();
    return lab.subscribe(push);
  }, [live, status]);

  // keep part labels pinned to the moving parts while inspecting
  useEffect(() => {
    if (!inspecting) return;
    const id = window.setInterval(() => setLabels(engine.current?.partLabels() ?? []), 50);
    return () => { window.clearInterval(id); setLabels([]); };
  }, [inspecting]);

  const machine = machines.find((m) => m.id === selected);
  const canInspect = machine?.kind === 'loom';
  const toggleInspect = () => {
    const e = engine.current;
    if (!e) return;
    if (inspecting) { e.inspect(null); setInspecting(null); setExploded(false); return; }
    if (e.inspect(selected)) setInspecting(selected);
  };
  const toggleExplode = () => { engine.current?.explode(!exploded); setExploded(!exploded); };
  const goCam = (v: CameraView) => { engine.current?.view(v); setCam(v); setInspecting(null); setExploded(false); };
  const hm = hover ? machines.find((m) => m.id === hover.id) : null;
  const hc = hm ? hm.cards[index] : null;
  const liveCards = live && hover?.id === 'LAB' ? getLabEngine().snap.cards : null;
  const lc = liveCards ? liveCards[liveCards.length - 1] : null;

  return (
    <div className={`shed-wrap${inspecting ? ' is-inspecting' : ''}`}>
      <div ref={host} className="shed" />
      {children}
      <div className="shed-ui">
        <div className="seg" role="group" aria-label="Camera">
          {(['shed', 'looms', 'utilities'] as CameraView[]).map((v) => (
            <button key={v} type="button" aria-pressed={cam === v && !inspecting} onClick={() => goCam(v)}>
              {v === 'shed' ? 'Shed' : v === 'looms' ? 'Looms' : 'Chakki, pumps'}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Inspect">
          <button type="button" aria-pressed={!!inspecting} disabled={!canInspect || status !== 'ready'} onClick={toggleInspect} title={canInspect ? 'X-ray the motor and show its drive-end bearing' : 'Select a loom to inspect its motor'}>
            <Icon name="eye" /> {inspecting ? 'Leave inspection' : 'Inspect motor'}
          </button>
          <button type="button" aria-pressed={exploded} disabled={!inspecting} onClick={toggleExplode}>
            <Icon name="explode" /> Explode
          </button>
        </div>
      </div>
      <p className="shed-hint">{inspecting ? 'Balls orbit at the cage frequency, slowed 40×. The spall flashes on every pass.' : 'Drag to orbit · scroll to zoom · double-click a loom to inspect'}</p>
      {hm && hc && !inspecting && (
        <div className="tag" style={{ left: hover!.x, top: hover!.y }}>
          <StatusIcon state={hc.off ? 'off' : hc.state} size={13} />
          {hm.name}
          <span>{st(hc.off ? 'off' : hc.state)} · {hc.off ? 'machine off' : `${hc.n} ${hc.n === 1 ? 'hole' : 'holes'}`}</span>
        </div>
      )}
      {hover && liveCards && !inspecting && (
        <div className="tag" style={{ left: hover.x, top: hover.y }}>
          <StatusIcon state={lc?.state ?? 'normal'} size={13} />
          Live machine
          <span>{lc ? `${st(lc.state)} · ${lc.holes.filter(Boolean).length} holes · card every 2 s` : 'waiting for its first card'}</span>
        </div>
      )}
      {labels.filter((l) => l.visible).map((l) => (
        <div key={l.id} className="part-label" style={{ left: l.x, top: l.y }}>
          <strong>{l.label}</strong>
          <span>{l.detail}</span>
        </div>
      ))}
      {status === 'loading' && <p className="shed-loading" role="status">Laying out the shed…</p>}
      {status === 'failed' && (
        <div className="shed-fallback">
          <p><strong>The 3D shed needs WebGL.</strong> The card record above carries the same data, card for card.</p>
        </div>
      )}
    </div>
  );
}
