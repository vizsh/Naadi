'use client';
// The card-index scrub: its track is data (the shed's worst state per card), and replay
// steps one card at a time, like a jacquard cylinder turning.
import { useEffect, useMemo, useRef, useState } from 'react';
import { N_PAST, cardLabel, type State } from '@/lib/model/core';
import type { Machine } from '@/lib/model/shed';
import { useWidth, useReducedMotion } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { Icon } from '@/components/shell/Icons';
import { Hatch } from '@/components/record/Hatch';

const RANK: Record<State, number> = { off: 0, normal: 1, watch: 2, act: 3 };
const FILL: Record<State, string> = { off: 'url(#strip-hatch)', normal: '#E2E6DD', watch: 'var(--watch)', act: 'var(--act)' };

export function ScrubBar({ machines, index, onIndex, inline = false }: { machines: Machine[]; index: number; onIndex: (k: number) => void; inline?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const W = useWidth(track);
  const reduced = useReducedMotion();
  const { t } = useT();
  const [playing, setPlaying] = useState(false);
  const worst = useMemo(
    () => Array.from({ length: N_PAST }, (_, k) => machines.reduce<State>((w, m) => {
      const c = m.cards[k];
      const s: State = c.off ? 'off' : c.state;
      return RANK[s] > RANK[w] ? s : w;
    }, 'off')),
    [machines],
  );
  const idx = useRef(index);
  useEffect(() => { idx.current = index; }, [index]);
  useEffect(() => {
    if (!playing) return;
    let k = idx.current >= N_PAST - 1 ? 0 : idx.current;
    onIndex(k);
    const id = window.setInterval(() => {
      k += 1;
      onIndex(k);
      if (k >= N_PAST - 1) setPlaying(false);
    }, reduced ? 30 : 115);
    return () => window.clearInterval(id);
  }, [playing, onIndex, reduced]);

  const step = W ? (W - 8) / (N_PAST - 1) : 0;
  const w = Math.max(1, step - 2);
  return (
    <div className={`scrub${inline ? ' scrub--inline' : ''}`}>
      <div className="scrub-btns">
        <button type="button" className="btn" onClick={() => setPlaying((p) => !p)}>
          <Icon name={playing ? 'pause' : 'play'} />
          {playing ? t('stop') : t('replay')}
        </button>
        {inline && <button type="button" className="btn-quiet" disabled={index === N_PAST - 1 && !playing} onClick={() => { setPlaying(false); onIndex(N_PAST - 1); }}>Back to now</button>}
      </div>
      <div className="scrub-track" ref={track}>
        {W > 0 && (
          <svg className="scrub-strip" width={W} height="16" viewBox={`0 0 ${W} 16`} aria-hidden="true">
            <defs><Hatch id="strip-hatch" /></defs>
            {worst.map((s, k) => (
              <rect key={k} x={4 + k * step - w / 2} y="0" width={w} height="16" fill={FILL[s]} opacity={k > index ? 0.3 : 1} />
            ))}
          </svg>
        )}
        <label className="sr-only" htmlFor={inline ? 'card-index-c' : 'card-index'}>Card index</label>
        <input id={inline ? 'card-index-c' : 'card-index'} type="range" min={0} max={N_PAST - 1} step={1} value={index} onChange={(e) => onIndex(Number(e.target.value))} />
      </div>
      <output className="mono" htmlFor={inline ? 'card-index-c' : 'card-index'}>Card {index + 1} of 56 · {cardLabel(index)}</output>
    </div>
  );
}
