'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { getModel } from '@/lib/model';
import { CHANNELS } from '@/lib/model/shed';
import { inr, mulberry32, gauss, N_PAST } from '@/lib/model/core';
import { defectFactors } from '@/lib/model/physics';
import { play, stop, synth } from '@/lib/audio/synth';
import { useMounted, useReducedMotion } from '@/lib/hooks';
import { Icon, StatusIcon } from '@/components/shell/Icons';

const PAINT = { normal: '#6E7B86', watch: '#D99A00', act: '#C8372A', off: '#CDD1CA' } as const;

/** Loom 03's last 24 cards, punched into the page one at a time. */
function HangingChain() {
  const { loom, post } = getModel();
  const reduced = useReducedMotion();
  const cards = loom.cards.slice(N_PAST - 18);
  const [n, setN] = useState(cards.length);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (reduced) return;
    let k = 0;
    const id = window.setInterval(() => {
      k = k >= cards.length + 8 ? 0 : k + 1;
      setN(Math.min(cards.length, k));
    }, 260);
    return () => window.clearInterval(id);
  }, [reduced, cards.length]);
  const W = 420, ch = 15, gap = 4, top = 30;
  return (
    <figure className="hero-chain">
      <svg viewBox={`0 0 ${W + 60} ${top + cards.length * (ch + gap) + 40}`} role="img" aria-label="Loom 03's last four and a half days of cards: slate, then amber, then vermilion as holes accumulate">
        <line x1="20" x2={W + 20} y1="16" y2="16" stroke="#9AA1A6" strokeWidth="5" />
        {[34, W + 6].map((x) => <path key={x} d={`M${x} 16 ` + cards.map((_, i) => `L${x + (i % 2 ? 6 : -6)} ${top + i * (ch + gap) + ch / 2}`).join(' ')} stroke="#17191C" strokeOpacity=".45" fill="none" />)}
        {cards.map((c, i) => {
          const y = top + i * (ch + gap), x = 20 + (i % 2 ? 8 : 0);
          const shown = i < n;
          return (
            <g key={c.k} opacity={shown ? 1 : 0.18}>
              <rect x={x} y={y} width={W - 8} height={ch} fill={shown ? PAINT[c.off ? 'off' : c.state] : 'none'} stroke={shown ? 'none' : '#17191C'} strokeDasharray="3 3" />
              {shown && c.holes.map((h, j) => h && <circle key={j} cx={x + 40 + j * 46} cy={y + ch / 2} r="4.6" fill="#17191C" />)}
            </g>
          );
        })}
        <text x="20" y={top + cards.length * (ch + gap) + 22} className="t-cap">Each card is six hours. Each hole is a channel that left Loom 03&apos;s own normal.</text>
      </svg>
      <figcaption>
        <StatusIcon state="act" /> <b>Loom 03, card 56</b> · {post[0].name.toLowerCase()} · {(post[0].p * 100).toFixed(1)}%
        <button type="button" className="btn-quiet" onClick={async () => { if (playing) { stop(); setPlaying(false); return; } setPlaying(true); await play(synth('now'), () => setPlaying(false)); }}>
          <Icon name={playing ? 'stop' : 'speaker'} />{playing ? 'Stop' : 'Hear Loom 03'}
        </button>
      </figcaption>
    </figure>
  );
}

function LearnNormalFigure() {
  const pts = useMemo(() => {
    const r = mulberry32(5);
    return Array.from({ length: 70 }, () => { const a = gauss(r), b = gauss(r); return [a * 1.0 + b * 0.35, b * 0.62]; });
  }, []);
  const X = (v: number) => Math.round((110 + v * 34) * 100) / 100, Y = (v: number) => Math.round((74 - v * 34) * 100) / 100;
  return (
    <svg viewBox="0 0 220 150" className="step-fig" role="img" aria-label="Normal readings form an ellipse; one reading falls outside and punches a hole">
      <ellipse cx={X(0)} cy={Y(0)} rx={2.9 * 34} ry={1.75 * 34} fill="none" stroke="#17191C" strokeDasharray="4 3" transform={`rotate(-12 ${X(0)} ${Y(0)})`} />
      {pts.map(([a, b], i) => <circle key={i} cx={X(a)} cy={Y(b)} r="2.6" fill="#6E7B86" />)}
      <circle cx={X(2.7)} cy={Y(1.75)} r="5" fill="#C8372A" />
      <text x={X(2.7) - 8} y={Y(1.75) - 9} className="t-cap" textAnchor="end">p &lt; 0.01</text>
    </svg>
  );
}

function CardFigure() {
  const c = getModel().loom.cards[N_PAST - 1];
  return (
    <svg viewBox="0 0 220 150" className="step-fig" role="img" aria-label="One card with eight hole positions; five are punched">
      <rect x="10" y="40" width="200" height="34" fill="#C8372A" />
      {CHANNELS.map((ch, j) => (
        <g key={ch.id}>
          {c.holes[j] ? <circle cx={24 + j * 24.5} cy="57" r="6.5" fill="#17191C" /> : <circle cx={24 + j * 24.5} cy="57" r="6.5" fill="none" stroke="#F9FAF6" strokeOpacity=".5" />}
          <text x={24 + j * 24.5} y="96" className="t-axis" textAnchor="middle" transform={`rotate(-50 ${24 + j * 24.5} 96)`}>{ch.short}</text>
        </g>
      ))}
    </svg>
  );
}

function SpectrumFigure() {
  const { spec } = getModel();
  const d = useMemo(() => {
    let s = '';
    for (let i = 0; i <= 200 / spec.df; i++) s += (i ? 'L' : 'M') + (10 + (spec.f[i] / 200) * 200).toFixed(1) + ' ' + (140 - ((Math.max(-66, spec.now[i]) + 66) / 24) * 120).toFixed(1);
    return s;
  }, [spec]);
  const bpfo = defectFactors().BPFO * spec.fr;
  return (
    <svg viewBox="0 0 220 150" className="step-fig" role="img" aria-label="Envelope spectrum with a peak at the bearing's outer-race frequency">
      {[1, 2].map((h) => <line key={h} x1={10 + (h * bpfo / 200) * 200} x2={10 + (h * bpfo / 200) * 200} y1="10" y2="140" stroke="#C8372A" />)}
      <path d={d} fill="none" stroke="#17191C" strokeWidth="1.1" />
      <text x={14 + (bpfo / 200) * 200} y="20" className="t-cap">BPFO {bpfo.toFixed(1)} Hz</text>
    </svg>
  );
}

function PhoneLink() {
  const mounted = useMounted();
  const [svg, setSvg] = useState<string>('');
  useEffect(() => {
    if (!mounted) return;
    QRCode.toString(`${window.location.origin}/lab`, { type: 'svg', margin: 0, color: { dark: '#17191C', light: '#F9FAF6' } }).then(setSvg).catch(() => {});
  }, [mounted]);
  return <div className="qr" aria-label="QR code that opens the Live Lab on a phone" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Overview() {
  const { cost, machines, loom } = getModel();
  return (
    <div className="overview">
      <section className="hero region">
        <div className="hero-text">
          <h1>Your loom has been telling you for weeks.</h1>
          <p className="lead">NAADI listens to every machine in a small factory, learns each one&apos;s normal, and punches a card every six hours. When the cards darken, it tells the owner what is wrong, how long is left, and what each repair window costs in rupees. The owner decides.</p>
          <div className="actions">
            <Link className="btn primary" href="/floor">Open the shed<Icon name="right" /></Link>
            <Link className="btn" href="/lab"><Icon name="mic" />Try it on your phone</Link>
            <Link className="btn" href="/agents"><Icon name="play" />Watch the agents</Link>
          </div>
          <ul className="facts">
            <li>No fault labels needed</li><li>Works offline</li><li>English · <span lang="hi">हिंदी</span> · <span lang="mr">मराठी</span></li><li>₹1,500 sensor, or a phone</li>
          </ul>
        </div>
        <HangingChain />
      </section>

      <section className="region receipts-wrap" aria-labelledby="h-cost">
        <h2 id="h-cost">Same bearing, two bills</h2>
        <p className="sub">Loom 03&apos;s motor bearing will fail either way. What it costs depends on whether anyone knew a week early.</p>
        <div className="receipts">
          <div className="receipt">
            <p className="receipt-title">If it runs to failure</p>
            <dl>
              <dt>Lost output, 16 h × ₹950</dt><dd>{inr(cost.parts.downtime)}</dd>
              <dt>Rush part, +60%</dt><dd>{inr(cost.parts.part)}</dd>
              <dt>Emergency call-out</dt><dd>{inr(cost.parts.callout)}</dd>
              <dt>Shaft or housing damage, 20% chance</dt><dd>{inr(cost.parts.secondary)}</dd>
            </dl>
            <p className="receipt-total"><span>Breakdown</span><b>{inr(cost.unplanned)}</b></p>
          </div>
          <div className="receipt receipt--good">
            <p className="receipt-title">If it is fixed in Thursday&apos;s power cut</p>
            <dl>
              <dt>Bearing, 6205-2RS</dt><dd>₹380</dd>
              <dt>Technician, planned</dt><dd>₹900</dd>
              <dt>Lost output (the loom is idle anyway)</dt><dd>₹0</dd>
            </dl>
            <p className="receipt-total"><span>Planned</span><b>{inr(cost.best.E)}</b></p>
          </div>
          <p className="receipt-diff"><b>{inr(cost.saving)}</b> apart. NAADI flagged the change on card {loom.ph!.alarm + 1}, about {Math.round(N_PAST / 4 + loom.rul!.p50 - (loom.ph!.alarm + 0.5) / 4)} days before failure becomes likely.</p>
        </div>
      </section>

      <section className="region how" aria-labelledby="h-how">
        <h2 id="h-how">How it works</h2>
        <ol className="how-steps">
          <li><span className="mono">01</span><h3>Listen</h3><p>Vibration, sound, current and temperature. The bearing number on the motor plate gives the fault frequencies.</p><SpectrumFigure /></li>
          <li><span className="mono">02</span><h3>Learn normal</h3><p>Each machine learns its own normal, per load. No one has to label a fault.</p><LearnNormalFigure /></li>
          <li><span className="mono">03</span><h3>Punch the card</h3><p>Every six hours, a hole for each channel that left normal. Holes add up to a trend.</p><CardFigure /></li>
          <li><span className="mono">04</span><h3>Decide</h3><p>Time to failure, the cause with its evidence, and each repair window in rupees. Agents draft; the owner approves.</p>
            <p className="decision-text small">Repair Loom 03 on <strong>Thursday, 14:00–18:00</strong>, during the scheduled power cut.</p></li>
        </ol>
      </section>

      <section className="doors" aria-label="Ways in">
        <Link href="/floor" className="region door door--shed">
          <h2>The shed</h2>
          <p className="sub">Nine machines, two weeks of cards, a 3D twin you can replay and x-ray.</p>
          <MiniRecord />
          <span className="link">Open the shed<Icon name="right" /></span>
        </Link>
        <Link href="/agents" className="region door">
          <h2>The agents</h2>
          <p className="sub">Cancel Thursday&apos;s power cut and watch seven agents move the repair to Sunday.</p>
          <ol className="door-steps">{['Sentinel', 'Diagnostician', 'Prognostician', 'Procurement', 'Planner', 'Dispatcher'].map((a) => <li key={a}>{a}</li>)}<li className="is-gate">Owner gate</li></ol>
          <span className="link">Run the agents<Icon name="right" /></span>
        </Link>
        <div className="region door">
          <h2>The Live Lab</h2>
          <p className="sub">Scan with your phone, hold it to a running fan, teach it normal, then touch the fan.</p>
          <PhoneLink />
          <Link className="link" href="/lab">Or open it here<Icon name="right" /></Link>
        </div>
      </section>

      <section className="region physics" aria-labelledby="h-physics">
        <h2 id="h-physics">Physics anyone can check</h2>
        <p className="formula-big">BPFO = <span>n</span>/2 × (1 − <span>d</span>/<span>D</span>) × f<sub>r</sub> = 9/2 × (1 − 0.203) × 23.95 Hz = <b>85.9 Hz</b></p>
        <p className="sub">Nine balls roll over a spall on the outer race 3.585 times per shaft turn. That is the peak in Loom 03&apos;s spectrum. Every diagnosis in NAADI shows its arithmetic and cites its rule.</p>
        <div className="actions"><Link className="link" href="/machine/L03">See it in the case file<Icon name="right" /></Link><Link className="link" href="/rulebook">Browse the rulebook<Icon name="right" /></Link><a className="link" href="https://github.com/vizsh/Naadi"><Icon name="github" />Read the code and the maths</a></div>
      </section>

      <footer className="foot">
        <p>NAADI · HackKumbh Nagpur · Track 4.3, Agentic AI. {machines.length} machines, {N_PAST} cards each. Every reading, name and price in this demo is synthetic; the physics and maths that turn them into decisions run live in your browser.</p>
      </footer>
    </div>
  );
}

function MiniRecord() {
  const { machines } = getModel();
  const from = N_PAST - 28;
  return (
    <svg viewBox={`0 0 ${28 * 9} ${machines.length * 10}`} className="mini-record" role="img" aria-label="Seven days of cards for all nine machines">
      {machines.map((m, i) => m.cards.slice(from).map((c, j) => (
        <g key={m.id + j}>
          <rect x={j * 9} y={i * 10} width="7" height="7" fill={c.off ? '#E9ECE4' : c.state === 'normal' ? '#E2E6DD' : PAINT[c.state]} />
          {c.n > 0 && !c.off && <circle cx={j * 9 + 3.5} cy={i * 10 + 3.5} r={c.n > 3 ? 2.4 : 1.6} fill="#17191C" />}
        </g>
      )))}
    </svg>
  );
}
