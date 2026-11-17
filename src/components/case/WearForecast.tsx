'use client';
// Degradation on a log scale (steady exponential wear draws a straight line), with the
// Monte Carlo forecast fan clipped to the plot rather than clamped into a fake plateau.
import { useId, useRef, useState } from 'react';
import { ACT_AT, N_PAST, WATCH_AT, cardLabel, cardStart, ist, monthName, pct } from '@/lib/model/core';
import type { Machine } from '@/lib/model/shed';
import { useWidth } from '@/lib/hooks';
import { hideTip, tipAt } from '@/lib/store';

const GRID = 'rgba(64,108,98,.11)', GRID_B = 'rgba(64,108,98,.26)';

export function WearForecast({ m, repairT }: { m: Machine; repairT?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 800;
  const H = 300;
  const mg = { l: 46, r: 72, t: 26, b: 34 };
  const pw = W - mg.l - mg.r, ph = H - mg.t - mg.b;
  const days = 26, dMin = 0.008, dMax = 1.4;
  const X = (t: number) => mg.l + (t / days) * pw;
  const Y = (d: number) => Math.round((mg.t + (1 - (Math.log10(d) - Math.log10(dMin)) / (Math.log10(dMax) - Math.log10(dMin))) * ph) * 100) / 100;
  const now = N_PAST / 4;
  const r = m.rul;
  const cid = useId().replace(/:/g, '');
  const [hx, setHx] = useState<number | null>(null);
  let measured = '', pen = false;
  for (const c of m.cards) {
    if (c.off) { pen = false; continue; }
    measured += (pen ? 'L' : 'M') + `${X(c.t).toFixed(1)} ${Y(c.dS).toFixed(1)}`;
    pen = true;
  }
  let fan = '', mid = '';
  if (r) {
    const z = 1.2816, bLo = r.bMed * Math.exp(-z * r.bSigma), bHi = r.bMed * Math.exp(z * r.bSigma);
    let up = '', lo = '';
    for (let t = now; t <= days + 0.001; t += 0.25) {
      const dt = t - now;
      up += `${X(t).toFixed(1)},${Y(Math.min(50, r.dNow * Math.exp(bHi * dt))).toFixed(1)} `;
      lo = `${X(t).toFixed(1)},${Y(Math.min(50, r.dNow * Math.exp(bLo * dt))).toFixed(1)} ` + lo;
      mid += (mid ? 'L' : 'M') + `${X(t).toFixed(1)} ${Y(Math.min(50, r.dNow * Math.exp(r.bMed * dt))).toFixed(1)}`;
    }
    fan = up + lo;
  }
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(days, ((e.clientX - rect.left - mg.l) / pw) * days));
    setHx(X(t));
    const k = Math.floor(t * 4);
    if (t <= now || !r) {
      const c = m.cards[Math.min(N_PAST - 1, k)];
      return tipAt(e, c.off ? 'Machine off' : `Degradation ${c.dS.toFixed(3)}`, [cardLabel(c.k)]);
    }
    const dt = t - now, z = 1.2816;
    const lo = r.dNow * Math.exp(r.bMed * Math.exp(-z * r.bSigma) * dt), hi = r.dNow * Math.exp(r.bMed * Math.exp(z * r.bSigma) * dt);
    tipAt(e, `P(failed by then) ${pct(r.cdf(dt))}`, [cardLabel(k), `Degradation P10–P90 ${Math.min(lo, 9).toFixed(2)}–${Math.min(hi, 9).toFixed(2)}`]);
  };
  const ticks = [0.01, 0.02, 0.03, 0.05, 0.1, 0.2, 0.3, 0.5, 1];
  return (
    <div className="chart" ref={wrap}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.name} degradation over 14 days with a 12-day forecast`} onPointerMove={move} onPointerLeave={() => { setHx(null); hideTip(); }}>
        <defs><clipPath id={cid}><rect x={mg.l} y={mg.t} width={pw} height={ph} /></clipPath></defs>
        {Array.from({ length: days + 1 }, (_, t) => <line key={t} x1={X(t)} x2={X(t)} y1={mg.t} y2={mg.t + ph} stroke={GRID} />)}
        {ticks.map((d) => <line key={d} x1={mg.l} x2={mg.l + pw} y1={Y(d)} y2={Y(d)} stroke={[0.01, 0.1, 1].includes(d) ? GRID_B : GRID} />)}
        {[0.01, 0.03, 0.1, 0.3, 1].map((d) => <text key={d} x={mg.l - 8} y={Y(d) + 4} className="t-num" textAnchor="end">{d}</text>)}
        {[0.5, 4.5, 8.5, 12.5, 16.5, 20.5, 24.5].map((t) => {
          const ms = cardStart(Math.round(t * 4));
          return <text key={t} x={X(t)} y={mg.t + ph + 18} className="t-num" textAnchor="middle">{ist(ms).day} {monthName(ms)}</text>;
        })}
        {([[WATCH_AT, 'var(--watch)', 'watch'], [ACT_AT, 'var(--act)', 'act'], [1, 'var(--ink)', 'failure level']] as const).map(([d, c, l]) => (
          <g key={l}>
            <line x1={mg.l} x2={mg.l + pw} y1={Y(d)} y2={Y(d)} stroke={c} strokeWidth={d === 1 ? 1.5 : 1.25} />
            <text x={mg.l + pw + 6} y={Y(d) + 4} className="t-cap">{l}</text>
          </g>
        ))}
        {r && (
          <g clipPath={`url(#${cid})`}>
            <polygon points={fan} fill="rgba(86,98,108,.16)" />
            <path d={mid} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="5 4" />
          </g>
        )}
        <path d={measured} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
        <line x1={X(now)} x2={X(now)} y1={mg.t} y2={mg.t + ph} stroke="var(--ink)" />
        <text x={X(now) - 4} y={mg.t - 8} className="t-cap" textAnchor="end">now</text>
        {repairT !== undefined && (
          <g>
            <line x1={X(now + repairT)} x2={X(now + repairT)} y1={mg.t} y2={mg.t + ph} stroke="var(--ink)" strokeWidth="2" />
            <text x={X(now + repairT) + 6} y={mg.t - 8} className="t-cap">repair</text>
          </g>
        )}
        {m.ph && (
          <g>
            <line x1={X((m.ph.alarm + 0.5) / 4)} x2={X((m.ph.alarm + 0.5) / 4)} y1={mg.t} y2={mg.t + ph} stroke="var(--ink-3)" strokeDasharray="2 3" />
            <text x={X((m.ph.alarm + 0.5) / 4) + 4} y={mg.t + 12} className="t-cap">change detected</text>
          </g>
        )}
        {r && ([['P10', r.p10], ['P50', r.p50], ['P90', r.p90]] as const).filter(([, t]) => now + t <= days).map(([lab, t]) => (
          <g key={lab}>
            <line x1={X(now + t)} x2={X(now + t)} y1={Y(1) - 5} y2={Y(1) + 5} stroke="var(--act)" strokeWidth="2" />
            <text x={X(now + t)} y={Y(1) - 9} className="t-num" textAnchor="middle">{lab}</text>
          </g>
        ))}
        {hx !== null && <line x1={hx} x2={hx} y1={mg.t} y2={mg.t + ph} stroke="var(--ink)" pointerEvents="none" />}
      </svg>
    </div>
  );
}
