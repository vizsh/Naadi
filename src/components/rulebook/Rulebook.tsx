'use client';
import { useMemo, useRef, useState } from 'react';
import { RULES, ruleSound, ruleSpectrum, type Rule } from '@/lib/rulebook';
import { CHANNELS } from '@/lib/model/shed';
import { play, stop } from '@/lib/audio/synth';
import { useWidth } from '@/lib/hooks';
import { hideTip, tipAt } from '@/lib/store';
import { Icon } from '@/components/shell/Icons';

const GRID = 'rgba(64,108,98,.11)', GRID_B = 'rgba(64,108,98,.26)';

export function Rulebook() {
  const [id, setId] = useState(RULES[0].id);
  const [playing, setPlaying] = useState<string | null>(null);
  const rule = RULES.find((r) => r.id === id)!;
  const families = [...new Set(RULES.map((r) => r.family))];
  const hear = async (r: Rule) => {
    if (playing === r.id) { stop(); setPlaying(null); return; }
    const s = ruleSound(r);
    setPlaying(r.id);
    await play(s.data, () => setPlaying((p) => (p === r.id ? null : p)), s.rate);
  };
  return (
    <section className="view-rules" aria-labelledby="rules-title">
      <div className="region rules-head">
        <h1 id="rules-title">The rulebook</h1>
        <p className="sub">Every fault NAADI can name: what it looks like in a spectrum, what it sounds like, which channels it punches, the evidence that moves it and what to do. Every diagnosis in the app cites one of these IDs.</p>
      </div>
      <div className="rules-grid">
        <nav className="region rules-index" aria-label="Rules">
          {families.map((f) => (
            <div key={f} className="rules-family">
              <h2>{f}</h2>
              <ul>
                {RULES.filter((r) => r.family === f).map((r) => (
                  <li key={r.id}>
                    <button type="button" aria-current={r.id === id} onClick={() => setId(r.id)}>
                      <span className="mono">{r.id}</span>
                      <span>{r.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <article className="region rule-detail step-in" key={rule.id}>
          <div className="region-head">
            <div>
              <p className="mono rule-id">{rule.id} · {rule.family} · {rule.machines}</p>
              <h2 className="rule-name">{rule.name}</h2>
            </div>
            <button type="button" className="btn" aria-pressed={playing === rule.id} onClick={() => hear(rule)}>
              <Icon name={playing === rule.id ? 'stop' : 'speaker'} />{playing === rule.id ? 'Stop' : 'Hear it'}
            </button>
          </div>
          <p className="rule-sig">{rule.signature}</p>
          <RuleSpectrum rule={rule} />
          <div className="rule-cols">
            <div>
              <h3>Channels it punches</h3>
              <ChannelCard channels={rule.channels} />
            </div>
            <div>
              <h3>Evidence and its weight</h3>
              <ul className="rule-ev">
                {rule.evidence.map(([e, lr]) => (
                  <li key={e}>
                    <span>{e}</span>
                    <span className="lr-cells" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < Math.round(lr) ? 'on' : undefined} />)}</span>
                    <b className="mono">×{lr.toFixed(1)}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <h3>What to do</h3>
          <p className="decision-text small">{rule.action}</p>
          <p className="fine">Source: {rule.source}. Likelihood ratios are expert-set and will be updated by each shed&apos;s repair log.</p>
        </article>
      </div>
    </section>
  );
}

function RuleSpectrum({ rule }: { rule: Rule }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 700;
  const H = 230, m = { l: 44, r: 12, t: 30, b: 32 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const { f, db } = useMemo(() => ruleSpectrum(rule), [rule]);
  const X = (v: number) => m.l + (v / 400) * pw;
  const Y = (v: number) => m.t + (1 - (Math.max(-68, Math.min(-36, v)) + 68) / 32) * ph;
  let d = '';
  for (let i = 0; i < f.length; i++) d += (i ? 'L' : 'M') + X(f[i]).toFixed(1) + ' ' + Y(db[i]).toFixed(1);
  const lines: React.ReactNode[] = [];
  for (let x = 0; x <= 400; x += 25) lines.push(<line key={'x' + x} x1={X(x)} x2={X(x)} y1={m.t} y2={m.t + ph} stroke={x % 100 ? GRID : GRID_B} />);
  for (let y = -68; y <= -36; y += 4) lines.push(<line key={'y' + y} x1={m.l} x2={m.l + pw} y1={Y(y)} y2={Y(y)} stroke={y % 8 ? GRID : GRID_B} />);
  return (
    <div className="chart" ref={wrap}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Signature spectrum for ${rule.name}`}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const fx = Math.max(0, Math.min(400, ((e.clientX - r.left - m.l) / pw) * 400)); const i = Math.round(fx / 0.5); tipAt(e, `${f[i].toFixed(1)} Hz`, [`${db[i].toFixed(1)} dB`]); }}
        onPointerLeave={hideTip}>
        {lines}
        {[0, 100, 200, 300, 400].map((x) => <text key={x} x={X(x)} y={H - 10} className="t-num" textAnchor="middle">{x}</text>)}
        <text x={m.l + pw} y={m.t - 12} className="t-cap" textAnchor="end">{rule.id === 'MTR-RB-01' ? 'Motor current spectrum, Hz' : 'Vibration spectrum, Hz'}</text>
        {rule.peaks.filter((p) => p.label).map((p) => (
          <g key={p.label! + p.f}>
            <line x1={X(p.f)} x2={X(p.f)} y1={m.t - 2} y2={m.t + ph} stroke="var(--act)" strokeWidth="1" />
            <text x={X(p.f)} y={m.t - 6} className="t-cur is-main" textAnchor="middle">{p.label}</text>
          </g>
        ))}
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth="1.25" />
      </svg>
    </div>
  );
}

function ChannelCard({ channels }: { channels: string[] }) {
  const all = channels.includes('all');
  return (
    <svg viewBox="0 0 280 92" className="rule-card" role="img" aria-label={`Punched channels: ${channels.join(', ')}`}>
      <rect x="0" y="8" width="280" height="30" fill="#C8372A" />
      {CHANNELS.map((c, j) => {
        const on = all || channels.includes(c.short);
        return (
          <g key={c.id}>
            {on ? <circle cx={20 + j * 34} cy="23" r="7" fill="#17191C" /> : <circle cx={20 + j * 34} cy="23" r="7" fill="none" stroke="#F9FAF6" strokeOpacity=".55" />}
            <text x={20 + j * 34} y="58" className="t-axis" textAnchor="middle" transform={`rotate(-40 ${20 + j * 34} 58)`}>{c.short}</text>
          </g>
        );
      })}
    </svg>
  );
}
