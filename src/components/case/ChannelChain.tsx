'use client';
// One machine, channel by channel: each column one card, each row one of the eight channels.
import { useRef } from 'react';
import { COLS, N_PAST, cardLabel } from '@/lib/model/core';
import { CHANNELS, REPAIR_CARD, offReason, type Machine } from '@/lib/model/shed';
import type { AsOf } from '@/lib/model/replay';
import { useWidth } from '@/lib/hooks';
import { hideTip, tipAt } from '@/lib/store';
import { Hatch } from '@/components/record/Hatch';
import { columns, dayTicks, daysX } from '@/components/record/cards';
import { activeKit, heroId } from '@/lib/model/setup';

const EDGE = { normal: '#B9C2C6', watch: 'var(--watch)', act: 'var(--act)', off: 'url(#hatch-c)' } as const;

/** With `at`, cards after the replayed one are blank and the change point and forecast are as known then. */
export function ChannelChain({ m, approved, noteK, at }: { m: Machine; approved: boolean; noteK?: number; at?: AsOf }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 1200;
  const labelW = 78;
  const pitch = Math.max(8, Math.min(13, Math.floor((W - labelW - 70) / COLS)));
  const cell = pitch - 2, row = Math.max(cell + 4, 15), top = 40;
  const { xs, end } = columns(labelW, pitch);
  const rowsY = (i: number) => top + 10 + i * row;
  const bottom = rowsY(CHANNELS.length);
  const H = bottom + 46;
  const width = Math.max(W, end + 8);
  const index = at ? at.k : N_PAST - 1;
  const replay = index < N_PAST - 1;
  const r = at ? at.rul : m.rul;
  const cp = at ? at.ph : m.ph;
  const tip = (e: React.PointerEvent) => {
    const t = (e.target as Element).closest('[data-k]') as SVGElement | null;
    if (!t) return hideTip();
    const k = Number(t.dataset.k), ch = Number(t.dataset.ch);
    const c = m.cards[k];
    if (k > index) return tipAt(e, 'Not yet punched at this point in the replay', [cardLabel(k)]);
    if (c.off) return tipAt(e, 'Machine off', [cardLabel(k), offReason(k) ?? '']);
    if (ch < 0) return tipAt(e, c.state === 'act' ? 'Act' : c.state === 'watch' ? 'Watch' : 'Normal', [`Card ${k + 1} of 56 · ${cardLabel(k)}`, `Degradation index ${c.dS.toFixed(3)}`]);
    const C = CHANNELS[ch];
    if (activeKit().missing.includes(C.id)) return tipAt(e, 'No sensor', [`${C.name} · card ${k + 1} of 56`, `${activeKit().label}: nothing reads this channel, so it is never punched`]);
    tipAt(e, c.holes[ch] ? 'Hole punched' : 'Within normal', [`${C.name} · card ${k + 1} of 56`, cardLabel(k), c.holes[ch] ? 'Tail probability under 0.01 for this regime' : 'Inside the learned band for this regime']);
  };
  return (
    <div className="scroll-x" ref={wrap}>
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`${m.name} card chain by channel`} onPointerMove={tip} onPointerLeave={hideTip}>
        <defs><Hatch id="hatch-c" /></defs>
        {dayTicks(pitch).map((d) => <text key={d.k} x={xs[d.k] + 1} y="24" className={`t-axis${d.sunday ? ' t-sun' : ''}`}>{d.text}</text>)}
        {m.cards.map((c) => (c.k > index
          ? <rect key={c.k} x={xs[c.k] + 0.5} y={top + 0.5} width={cell - 1} height={4} className="c-blank" data-k={c.k} data-ch={-1} />
          : <rect key={c.k} x={xs[c.k]} y={top} width={cell} height={5} fill={EDGE[c.off ? 'off' : c.state]} data-k={c.k} data-ch={-1} />))}
        {CHANNELS.map((ch, i) => {
          const y = rowsY(i);
          return (
            <g key={ch.id} opacity={activeKit().missing.includes(ch.id) ? 0.35 : undefined}>
              <text x="0" y={y + cell / 2 + 4} className="t-row">{ch.short}</text>
              {Array.from({ length: COLS }, (_, k) => {
                const x = xs[k];
                if (k >= N_PAST) {
                  return k === REPAIR_CARD && m.id === heroId() && !replay
                    ? <rect key={k} x={x + 0.75} y={y + 0.75} width={cell - 1.5} height={cell - 1.5} fill={approved ? 'var(--ink)' : 'none'} stroke="var(--ink)" strokeWidth="1.5" />
                    : <rect key={k} x={x + 0.5} y={y + 0.5} width={cell - 1} height={cell - 1} className="c-blank" />;
                }
                const c = m.cards[k];
                if (k > index) return <rect key={k} x={x + 0.5} y={y + 0.5} width={cell - 1} height={cell - 1} className="c-blank" data-k={k} data-ch={i} />;
                return (
                  <g key={k}>
                    <rect x={x} y={y} width={cell} height={cell} fill={c.off ? 'url(#hatch-c)' : '#E2E6DD'} data-k={k} data-ch={i} />
                    {c.holes[i] && <circle cx={x + cell / 2} cy={y + cell / 2} r={cell * 0.3} fill="var(--ink)" pointerEvents="none" />}
                  </g>
                );
              })}
            </g>
          );
        })}
        <line x1={xs[N_PAST] - 6} x2={xs[N_PAST] - 6} y1={top - 6} y2={bottom} stroke="var(--ink)" strokeWidth="1.5" />
        {replay && <line x1={xs[index] + cell + 1} x2={xs[index] + cell + 1} y1={top - 8} y2={bottom} stroke="var(--ink)" strokeDasharray="3 2" />}
        {cp && (
          <g>
            <line x1={xs[cp.onset] + cell / 2} x2={xs[cp.onset] + cell / 2} y1={top - 6} y2={bottom + 8} stroke="var(--ink-3)" strokeDasharray="2 3" />
            <line x1={xs[cp.alarm] + cell / 2} x2={xs[cp.alarm] + cell / 2} y1={top - 6} y2={bottom + 22} stroke="var(--ink)" />
            <text x={xs[cp.onset] + cell / 2 - 4} y={bottom + 18} className="t-cap" textAnchor="end">Wear began · card {cp.onset + 1}</text>
            <text x={xs[cp.alarm] + cell / 2 + 4} y={bottom + 32} className="t-cap">Change detected · card {cp.alarm + 1}</text>
          </g>
        )}
        {noteK !== undefined && noteK <= index && (
          <g>
            <path d={`M${xs[noteK] + cell / 2} ${bottom + 4}v6`} stroke="var(--ink)" />
            <use href="#i-note-ink" x={xs[noteK] + cell / 2 - 7} y={bottom + 10} width="14" height="14" />
          </g>
        )}
        {r && (() => {
          const yb = bottom + 14, a = daysX(xs, pitch, r.p10, index + 1), b = daysX(xs, pitch, r.p90, index + 1), c = daysX(xs, pitch, r.p50, index + 1);
          return (
            <g>
              <line x1={a} x2={b} y1={yb} y2={yb} stroke="var(--act)" strokeWidth="2" />
              <line x1={a} x2={a} y1={yb - 5} y2={yb + 5} stroke="var(--act)" strokeWidth="2" />
              <line x1={b} x2={b} y1={yb - 5} y2={yb + 5} stroke="var(--act)" strokeWidth="2" />
              <rect x={c - 3.5} y={yb - 3.5} width="7" height="7" fill="var(--act)" transform={`rotate(45 ${c} ${yb})`} />
              {b - a >= 190 ? (
                <>
                  <text x={a} y={yb + 20} className="t-num" textAnchor="middle">P10 {r.p10.toFixed(1)} d</text>
                  <text x={c} y={yb + 20} className="t-num" textAnchor="middle">P50 {r.p50.toFixed(1)} d</text>
                  <text x={b} y={yb + 20} className="t-num" textAnchor="middle">P90 {r.p90.toFixed(1)} d</text>
                </>
              ) : (
                <text x={a - 4} y={yb + 20} className="t-num">P10 {r.p10.toFixed(1)} · P50 {r.p50.toFixed(1)} · P90 {r.p90.toFixed(1)} d</text>
              )}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
