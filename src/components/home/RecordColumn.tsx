'use client';
// The landing page's pinned record: the hero machine's whole fortnight as one column of punched cards,
// a row per six hours and a column per channel, with the degradation trace drawn beside it on
// a log scale. Scrolling fills it in row by row; cards ahead stay dashed, the repair card waits
// at the foot, and the row being read is outlined in ink.
import { ACT_AT, N_PAST, WATCH_AT, cardLabel, cardStart, ist, weekday } from '@/lib/model/core';
import { CHANNELS, REPAIR_CARD, type Machine } from '@/lib/model/shed';
import { heroName } from '@/lib/model/setup';

const W = 600, H = 920, TOP = 80, FOOT = 70;
const ROWS = REPAIR_CARD + 1;
const RH = (H - TOP - FOOT) / ROWS;
const HX = 92, HW = 28, TX0 = HX + 8 * HW + 22, TX1 = W - 14;
const PAINT = { normal: '#E2E6DD', watch: '#D99A00', act: '#C8372A', off: '#E9ECE4' } as const;
const SHORT = ['Vel', 'Kurt', 'Env', '1×', '2×', 'Snd', 'Amp', 'Tmp'];
const r1 = (v: number) => Math.round(v * 10) / 10;
const lx = (d: number) => r1(TX0 + ((Math.log10(Math.max(0.008, d)) - Math.log10(0.008)) / (Math.log10(1) - Math.log10(0.008))) * (TX1 - TX0));

export function RecordColumn({ m, k, approved }: { m: Machine; k: number; approved: boolean }) {
  const y = (j: number) => r1(TOP + j * RH);
  const shown = Math.min(k, N_PAST - 1);
  const c = m.cards[shown];
  let trace = '', pen = false;
  for (let j = 0; j <= shown; j++) {
    const cc = m.cards[j];
    if (cc.off) { pen = false; continue; }
    trace += `${pen ? 'L' : 'M'}${lx(cc.dS)} ${r1(y(j) + RH / 2)}`;
    pen = true;
  }
  const alarm = m.ph?.alarm ?? -1;
  return (
    <svg className="record-col" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMin meet" role="img" aria-label={`${heroName()}'s punched cards up to card ${shown + 1}, with its degradation index`}>
      {/* headings */}
      <text x="0" y="18" className="rc-title">{heroName()} · one row per six hours</text>
      {SHORT.map((s, i) => <text key={s} x={HX + i * HW + HW / 2} y={TOP - 10} className="rc-col" textAnchor="middle">{s}</text>)}
      <text x={TX0} y={TOP - 10} className="rc-col">degradation, log</text>
      {[[WATCH_AT, 'var(--watch)', 'watch'], [ACT_AT, 'var(--act)', 'act'], [1, 'var(--ink)', 'fail']].map(([d, col, l]) => (
        <g key={l as string}>
          <line x1={lx(d as number)} x2={lx(d as number)} y1={TOP - 4} y2={y(N_PAST)} stroke={col as string} strokeWidth="1.2" />
          <text x={lx(d as number) - 3} y={TOP - 30} className="rc-cap" textAnchor="end">{l as string}</text>
        </g>
      ))}
      {/* rows */}
      {Array.from({ length: ROWS }, (_, j) => {
        const yy = y(j), h = RH - 2;
        const p = ist(cardStart(j));
        const dayStart = j === 0 || ist(cardStart(j - 1)).day !== p.day;
        const future = j > shown;
        const cc = j < N_PAST ? m.cards[j] : null;
        return (
          <g key={j}>
            {dayStart && <text x="0" y={r1(yy + h - 1)} className={`rc-day${p.wd === 0 ? ' is-sun' : ''}`}>{weekday(cardStart(j))} {p.day}</text>}
            {j === REPAIR_CARD ? (
              <rect x={HX} y={yy} width={8 * HW - 2} height={h} fill={approved ? 'var(--ink)' : 'none'} stroke="var(--ink)" strokeWidth="1.4" />
            ) : future || !cc ? (
              <rect x={HX + 0.5} y={yy + 0.5} width={8 * HW - 3} height={h - 1} className="c-blank" />
            ) : (
              <>
                <rect x={HX} y={yy} width={8 * HW - 2} height={h} fill={cc.off ? PAINT.off : PAINT[cc.state]} />
                {cc.holes.map((hit, i) => hit && <circle key={i} cx={r1(HX + i * HW + HW / 2 - 1)} cy={r1(yy + h / 2)} r={r1(Math.min(4.2, h * 0.36))} fill="#17191C" />)}
              </>
            )}
          </g>
        );
      })}
      {/* the trace and the change point */}
      <path d={trace} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
      {alarm >= 0 && alarm <= shown && (
        <g>
          <line x1={TX0} x2={TX1} y1={r1(y(alarm) + RH / 2)} y2={r1(y(alarm) + RH / 2)} stroke="var(--ink-3)" strokeDasharray="2 3" />
          <text x={TX1} y={r1(y(alarm) - 2)} className="rc-cap" textAnchor="end">change detected</text>
        </g>
      )}
      <text x={TX1} y={r1(y(REPAIR_CARD) + RH - 3)} className="rc-cap" textAnchor="end">{approved ? 'repair booked' : 'repair window'}</text>
      {/* the row being read */}
      <rect x={HX - 4} y={r1(y(shown) - 2)} width={TX1 - HX + 8} height={r1(RH + 2)} fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      <path d={`M${HX - 12} ${r1(y(shown) + RH / 2 - 5)}l7 5-7 5z`} fill="var(--ink)" />
      <text x="0" y={H - 38} className="rc-now">Card {shown + 1} · {cardLabel(shown)}</text>
      <text x="0" y={H - 14} className="rc-cap">
        {c.off ? 'Machine off, not scored' : `${c.n ? `${CHANNELS.filter((_, i) => c.holes[i]).map((x) => x.short).join(', ')} left normal` : 'every channel inside its normal'} · degradation ${c.dS.toFixed(3)}`}
      </text>
    </svg>
  );
}
