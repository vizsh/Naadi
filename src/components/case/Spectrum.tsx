'use client';
// Envelope spectrum on point paper aligned to the data: fine lines every 10 Hz and 1 dB,
// bold every 50 Hz and 5 dB. Cursors follow the speed control; the measured peaks do not.
import { useMemo, useRef, useState } from 'react';
import { defectFactors, spectrumFacts, type Spectrum as Spec } from '@/lib/model/physics';
import { useWidth } from '@/lib/hooks';
import { hideTip, tipAt } from '@/lib/store';

const Y0 = -68, Y1 = -38;
const GRID = 'rgba(64,108,98,.11)', GRID_B = 'rgba(64,108,98,.26)';

export function Spectrum({ spec, rpm, callout = true }: { spec: Spec; rpm: number; callout?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 800;
  const H = Math.round(Math.max(300, Math.min(460, W * 0.44)));
  const m = { l: 52, r: 18, t: 46, b: 40 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const X = (f: number) => m.l + (f / spec.fmax) * pw;
  const Y = (db: number) => m.t + (1 - (Math.max(Y0, Math.min(Y1, db)) - Y0) / (Y1 - Y0)) * ph;
  const [hx, setHx] = useState<number | null>(null);
  const paths = useMemo(() => {
    const p = (arr: Float64Array) => {
      let s = '';
      for (let i = 0; i < arr.length; i++) s += (i ? 'L' : 'M') + X(spec.f[i]).toFixed(1) + ' ' + Y(arr[i]).toFixed(1);
      return s;
    };
    return { now: p(spec.now), base: p(spec.base) };
    // X and Y depend only on W and H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, W, H]);
  const F = defectFactors();
  const fr = rpm / 60;
  const fam = [
    ...[1, 2, 3, 4].map((h) => ({ f: h * F.BPFO * fr, label: h === 1 ? 'BPFO' : `${h}×`, main: true })),
    { f: F.FTF * fr, label: 'FTF', main: false }, { f: fr, label: '1×', main: false },
    { f: F.BSF * fr, label: 'BSF', main: false }, { f: F.BPFI * fr, label: 'BPFI', main: false },
  ].filter((c) => c.f <= spec.fmax);
  const facts = spectrumFacts(spec);
  const pi = Math.round(facts.peakHz / spec.df);
  const px = Math.round(X(facts.peakHz) * 100) / 100, py = Math.round(Y(spec.now[pi]) * 100) / 100;
  const lx = Math.min(px + 46, m.l + pw - 230), ly = Math.max(m.t + 16, py - 20);

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.max(0, Math.min(spec.fmax, ((e.clientX - r.left - m.l) / pw) * spec.fmax));
    const i = Math.round(f / spec.df);
    setHx(X(spec.f[i]));
    const near = fam.reduce((a, c) => (Math.abs(c.f - f) < Math.abs(a.f - f) ? c : a), fam[0]);
    const lines = [`This card ${spec.now[i].toFixed(1)} dB`, `Baseline ${spec.base[i].toFixed(1)} dB`];
    if (Math.abs(near.f - f) < 6) lines.push(`Nearest cursor: ${near.main ? 'BPFO ' + near.label.replace('BPFO', '1×') : near.label} at ${near.f.toFixed(1)} Hz`);
    tipAt(e, `${spec.f[i].toFixed(2)} Hz`, lines);
  };

  const fine: React.ReactNode[] = [];
  for (let f = 0; f <= spec.fmax; f += 10) fine.push(<line key={'x' + f} x1={X(f)} x2={X(f)} y1={m.t} y2={m.t + ph} stroke={f % 50 ? GRID : GRID_B} />);
  for (let d = Y0; d <= Y1; d += 1) fine.push(<line key={'y' + d} x1={m.l} x2={m.l + pw} y1={Y(d)} y2={Y(d)} stroke={d % 5 ? GRID : GRID_B} />);
  return (
    <div className="chart" ref={wrap}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Envelope spectrum from 0 to 400 hertz with bearing defect frequency cursors" onPointerMove={move} onPointerLeave={() => { setHx(null); hideTip(); }}>
        {fine}
        {Array.from({ length: 9 }, (_, i) => i * 50).map((f) => <text key={f} x={X(f)} y={m.t + ph + 18} className="t-num" textAnchor="middle">{f}</text>)}
        {[-65, -60, -55, -50, -45, -40].map((d) => <text key={d} x={m.l - 8} y={Y(d) + 4} className="t-num" textAnchor="end">{d}</text>)}
        <text x={m.l + pw} y={H - 6} className="t-cap" textAnchor="end">Frequency, Hz</text>
        <text x={m.l - 8} y={m.t - 10} className="t-cap" textAnchor="end">dB</text>
        {fam.map((c) => (
          <g key={c.label}>
            <line x1={X(c.f)} x2={X(c.f)} y1={c.main ? m.t - 4 : m.t - 18} y2={m.t + ph} stroke={c.main ? 'var(--act)' : 'var(--ink-3)'} strokeWidth={c.main ? 1.25 : 1} strokeDasharray={c.main ? undefined : '3 3'} />
            <text x={X(c.f)} y={c.main ? m.t - 8 : m.t - 22} className={`t-cur${c.main ? ' is-main' : ''}`} textAnchor="middle">{c.label}</text>
          </g>
        ))}
        <path d={paths.base} fill="none" stroke="#80837B" strokeWidth="1.1" strokeLinejoin="round" />
        <path d={paths.now} fill="none" stroke="var(--ink)" strokeWidth="1.25" strokeLinejoin="round" />
        {callout && (
          <g>
            <path d={`M${px + 3} ${py - 2}L${lx - 4} ${ly - 4}`} stroke="var(--ink)" fill="none" />
            <rect x={lx - 2} y={ly - 16} width="226" height="22" fill="var(--paper-hi)" />
            <text x={lx + 4} y={ly} className="t-note">{facts.peakHz.toFixed(1)} Hz · {facts.overBase.toFixed(1)} dB over baseline</text>
          </g>
        )}
        {hx !== null && <line x1={hx} x2={hx} y1={m.t} y2={m.t + ph} stroke="var(--ink)" pointerEvents="none" />}
      </svg>
    </div>
  );
}
