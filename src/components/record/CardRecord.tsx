'use client';
// The shed's card record: machines as rows, six-hour cards as columns, blank cards ahead.
import { memo, useRef } from 'react';
import { COLS, N_PAST, cardLabel, pct } from '@/lib/model/core';
import { CHANNELS, REPAIR_CARD, offReason, type Machine } from '@/lib/model/shed';
import type { Rul } from '@/lib/model/decide';
import { useWidth } from '@/lib/hooks';
import { hideTip, tipAt } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Hatch } from './Hatch';
import { PAINT, columns, dayTicks, daysX, holeR } from './cards';

interface Props {
  machines: Machine[];
  index: number;
  selected: string;
  approved: boolean;
  rul: Rul | null;
  onSelect: (id: string) => void;
}

export const CardRecord = memo(function CardRecord({ machines, index, selected, approved, rul, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap);
  const { st } = useT();
  const labelW = W && W < 560 ? 84 : 104;
  const pitch = Math.max(W && W < 640 ? 10 : 8, Math.min(13, Math.floor(((W || 1100) - 82) / COLS)));
  const cell = pitch - 2, row = Math.max(cell + 5, 15), top = 34;
  const { xs, end } = columns(4, pitch);
  const H = top + machines.length * row + 40;
  const width = Math.max(W, end + 8);
  const live = index === N_PAST - 1;
  const bottom = top + machines.length * row;
  const li = machines.findIndex((m) => m.id === 'L03');
  const rx = xs[REPAIR_CARD];

  const tip = (e: React.PointerEvent) => {
    const t = (e.target as Element).closest('[data-k]') as SVGElement | null;
    if (!t) return hideTip();
    const m = machines.find((x) => x.id === t.dataset.m)!;
    const k = Number(t.dataset.k);
    if (k >= N_PAST) {
      const lines = [`${m.name} · ${cardLabel(k)}`];
      const off = offReason(k);
      if (off) lines.push(off);
      if (m.id === 'L03' && rul) lines.push(`P(failed by the end of this card) ${pct(rul.cdf((k + 1 - N_PAST) / 4))}`);
      return tipAt(e, m.id === 'L03' && k === REPAIR_CARD ? 'Planned repair, 14:00–18:00' : 'Not yet punched', lines);
    }
    const c = m.cards[k];
    if (k > index) return tipAt(e, 'Not yet punched at this point in the replay', [`${m.name} · ${cardLabel(k)}`]);
    if (c.off) return tipAt(e, 'Machine off', [`${m.name} · card ${k + 1} of 56`, cardLabel(k), offReason(k) ?? '']);
    const names = CHANNELS.filter((_, i) => c.holes[i]).map((ch) => ch.short);
    tipAt(e, st(c.state), [
      `${m.name} · card ${k + 1} of 56`,
      cardLabel(k),
      names.length ? `Holes: ${names.join(', ')}` : 'No holes: every channel inside its normal',
      `Degradation index ${c.dS.toFixed(3)}`,
    ]);
  };
  const pick = (e: React.MouseEvent) => {
    const t = (e.target as Element).closest('[data-m]') as SVGElement | null;
    if (t?.dataset.m) onSelect(t.dataset.m);
  };

  return (
    <div className="dd">
      <svg width={labelW} height={H} viewBox={`0 0 ${labelW} ${H}`} aria-label="Machines">
        {machines.map((m, i) => {
          const y = top + i * row;
          const c = m.cards[index];
          const s = live ? m.now.state : c.off ? 'off' : c.state;
          return (
            <g
              key={m.id}
              className={`dd-label${m.id === selected ? ' is-sel' : ''}`}
              data-m={m.id}
              role="button"
              tabIndex={0}
              aria-pressed={m.id === selected}
              aria-label={`${m.name}, ${st(s)}`}
              onClick={pick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(m.id); } }}
            >
              <rect x="0" y={y - 2} width={labelW - 6} height={row} fill="transparent" />
              <use href={`#i-${s}`} x="0" y={y + cell / 2 - 7} width="14" height="14" />
              <text x="20" y={y + cell / 2 + 4} className="t-row">{m.name}</text>
            </g>
          );
        })}
      </svg>
      <div className="scroll-x" ref={wrap}>
        <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Card record for nine machines over 14 days, with 12 days of blank forecast cards" onPointerMove={tip} onPointerLeave={hideTip} onClick={pick}>
          <defs><Hatch /></defs>
          <text x={xs[0]} y="11" className="t-cap">Punched · one card per 6 h</text>
          <text x={xs[N_PAST]} y="11" className="t-cap">Ahead · blank cards, not yet punched</text>
          {dayTicks(pitch).map((d) => (
            <text key={d.k} x={xs[d.k] + 1} y="26" className={`t-axis${d.sunday ? ' t-sun' : ''}`}>{d.text}</text>
          ))}
          <rect x={rx - 2} y={top - 4} width={cell + 4} height={machines.length * row + 2} fill="#E9ECE4" />
          {machines.map((m, i) => {
            const y = top + i * row;
            return (
              <g key={m.id}>
                {Array.from({ length: COLS }, (_, k) => {
                  const x = xs[k];
                  if (k < N_PAST) {
                    const c = m.cards[k];
                    if (k > index) return <rect key={k} x={x + 0.5} y={y + 0.5} width={cell - 1} height={cell - 1} className="c-blank" data-m={m.id} data-k={k} />;
                    const r = holeR(c.n, cell);
                    return (
                      <g key={k}>
                        <rect x={x} y={y} width={cell} height={cell} fill={c.off ? PAINT.off : PAINT[c.state]} data-m={m.id} data-k={k} />
                        {r > 0 && <circle cx={x + cell / 2} cy={y + cell / 2} r={r} fill="var(--ink)" pointerEvents="none" />}
                      </g>
                    );
                  }
                  const dim = live ? undefined : 0.3;
                  if (m.id === 'L03' && k === REPAIR_CARD) {
                    return approved ? (
                      <g key={k} opacity={dim}>
                        <rect x={x} y={y} width={cell} height={cell} fill="var(--ink)" data-m={m.id} data-k={k} />
                        <path d={`M${x + cell * 0.22} ${y + cell * 0.52}l${cell * 0.2} ${cell * 0.2} ${cell * 0.36} -${cell * 0.42}`} stroke="var(--paper)" strokeWidth="1.4" fill="none" pointerEvents="none" />
                      </g>
                    ) : (
                      <rect key={k} x={x + 0.75} y={y + 0.75} width={cell - 1.5} height={cell - 1.5} fill="none" stroke="var(--ink)" strokeWidth="1.5" data-m={m.id} data-k={k} opacity={dim} />
                    );
                  }
                  return offReason(k) ? (
                    <rect key={k} x={x} y={y} width={cell} height={cell} fill={PAINT.off} opacity={(dim ?? 1) * 0.55} data-m={m.id} data-k={k} />
                  ) : (
                    <rect key={k} x={x + 0.5} y={y + 0.5} width={cell - 1} height={cell - 1} className="c-blank" data-m={m.id} data-k={k} opacity={dim} />
                  );
                })}
              </g>
            );
          })}
          <line x1={xs[N_PAST] - 6} x2={xs[N_PAST] - 6} y1={top - 8} y2={bottom} stroke="var(--ink)" strokeWidth="1.5" />
          {!live && <line x1={xs[index] + cell + 1} x2={xs[index] + cell + 1} y1={top - 8} y2={bottom} stroke="var(--ink)" strokeDasharray="3 2" />}
          {live && rul && li >= 0 && (() => {
            const yb = top + li * row + cell / 2;
            const a = daysX(xs, pitch, rul.p10), b = daysX(xs, pitch, rul.p90), c = daysX(xs, pitch, rul.p50);
            const ly = bottom + 15;
            return (
              <g>
                <line x1={a} x2={b} y1={yb} y2={yb} stroke="var(--act)" strokeWidth="2" />
                <line x1={a} x2={a} y1={yb - 5} y2={yb + 5} stroke="var(--act)" strokeWidth="2" />
                <line x1={b} x2={b} y1={yb - 5} y2={yb + 5} stroke="var(--act)" strokeWidth="2" />
                <rect x={c - 3.5} y={yb - 3.5} width="7" height="7" fill="var(--act)" transform={`rotate(45 ${c} ${yb})`} />
                <text x={rx + cell / 2} y={ly} className="t-cap" textAnchor="middle">{approved ? 'Repair booked' : 'Repair window'}</text>
                <text x={a} y={ly} className="t-num" textAnchor="middle">P10 {rul.p10.toFixed(1)} d</text>
                <text x={c} y={ly} className="t-num" textAnchor="middle">P50 {rul.p50.toFixed(1)} d</text>
                <text x={b} y={ly} className="t-num" textAnchor="middle">P90 {rul.p90.toFixed(1)} d</text>
                <text x={(a + b) / 2} y={ly + 16} className="t-cap" textAnchor="middle">Loom 03 failure window, P10 to P90</text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
});
