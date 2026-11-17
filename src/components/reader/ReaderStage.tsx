'use client';
// React host for the jacquard reading head. Three.js loads after first paint; the eight needle
// labels and the readout are HTML pinned to the projected head, moved directly by the engine's
// frame callback so React only re-renders when the card being read changes.
import { useEffect, useRef, useState } from 'react';
import type { ReaderAnchors, ReaderCard, ReaderEngine } from '@/lib/reader/engine';
import { useReducedMotion } from '@/lib/hooks';

interface Props {
  cards: ReaderCard[];
  /** the card the chain should feed to */
  index: number;
  /** what the eight hole positions mean on card k */
  labels: (k: number) => string[];
  /** the line beside the head for card k (null while the chain moves) */
  readout?: (k: number | null) => React.ReactNode;
  /** the owner's latch is down across the chain */
  latch?: boolean;
  onLatch?: () => void;
  latchLabel?: string;
  /** cards per second */
  speed?: number;
  className?: string;
  label: string;
}

export function ReaderStage({ cards, index, labels, readout, latch = false, onLatch, latchLabel = 'Approve', speed, className = '', label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<ReaderEngine | null>(null);
  const flags = useRef<(HTMLSpanElement | null)[]>([]);
  const head = useRef<HTMLDivElement>(null);
  const latchEl = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [reading, setReading] = useState<number | null>(null);
  const cardsRef = useRef(cards);

  useEffect(() => {
    let cancelled = false;
    let made: ReaderEngine | null = null;
    (async () => {
      try {
        const { ReaderEngine } = await import('@/lib/reader/engine');
        if (cancelled || !host.current) return;
        made = new ReaderEngine(host.current, {
          cards: cardsRef.current,
          reducedMotion: reduced,
          speed,
          onAnchors: (a: ReaderAnchors) => {
            a.needles.forEach((p, i) => {
              const el = flags.current[i];
              if (el) el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
            });
            if (head.current) head.current.style.transform = `translate(${Math.round(a.head.x)}px, ${Math.round(a.head.y)}px)`;
            const le = latchEl.current;
            if (le) {
              le.hidden = !a.latch;
              if (a.latch) le.style.transform = `translate(${Math.round(a.latch.x)}px, ${Math.round(a.latch.y)}px)`;
            }
            setReading(a.reading);
          },
        });
        engine.current = made;
        if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __reader: unknown }).__reader = made;
        setStatus('ready');
      } catch (err) {
        console.error('3D reader unavailable:', err);
        if (!cancelled) setStatus('failed');
      }
    })();
    return () => { cancelled = true; made?.dispose(); engine.current = null; };
    // built once per mount; later changes flow through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cardsRef.current = cards; engine.current?.setCards(cards); }, [cards, status]);
  useEffect(() => { engine.current?.setIndex(index); }, [index, status]);
  useEffect(() => { engine.current?.setLatch(latch); }, [latch, status]);

  const k = reading ?? index;
  const names = labels(k);
  const card = reading !== null ? cards[reading] : null;
  return (
    <div className={`reader ${className}`} role="img" aria-label={label}>
      <div ref={host} className="reader-gl" />
      <div className="reader-flags" aria-hidden="true">
        {names.map((n, i) => (
          <span key={i} ref={(el) => { flags.current[i] = el; }} className={`reader-flag${i % 2 ? ' is-low' : ''}${card && card.paint !== 'blank' && card.holes[i] ? ' is-hole' : ''}`}>
            <b>{n}</b>
          </span>
        ))}
      </div>
      {readout && <div ref={head} className="reader-readout"><div className="rr">{readout(reading)}</div></div>}
      {onLatch && (
        <div ref={latchEl} className="reader-latch" hidden>
          <button type="button" className="btn primary" onClick={onLatch}>{latchLabel}</button>
        </div>
      )}
      {status === 'loading' && <p className="reader-note" role="status">Setting up the reading head…</p>}
      {status === 'failed' && <p className="reader-note">The 3D reader needs WebGL. Everything it reads is also written out beside it.</p>}
    </div>
  );
}
