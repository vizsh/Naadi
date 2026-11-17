'use client';
// The landing page: a fortnight in one scroll. Loom 03's punched-card record is pinned on the
// left, a row per six hours beside its degradation trace; scrolling fills it in row by row, and each chapter on the right is
// computed as of the card under the head: the card itself, learning normal, the change caught,
// the spectrum, the forecast, the ranked causes, the rupees, the agents and the owner.
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { getModel } from '@/lib/model';
import { CHANNELS, REPAIR_CARD } from '@/lib/model/shed';
import { N_PAST, cardLabel, gauss, inr, mulberry32, pct } from '@/lib/model/core';
import { asOf, evidenceAt, postAt, spectrumAt } from '@/lib/model/replay';
import { defectFactors } from '@/lib/model/physics';
import { activeFault } from '@/lib/model/setup';
import { planRun } from '@/lib/agents/pipeline';
import { play, stop, synth } from '@/lib/audio/synth';
import { useMounted } from '@/lib/hooks';
import { useNaadi } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Icon, StatusIcon } from '@/components/shell/Icons';
import { RecordColumn } from './RecordColumn';
import { ChannelChain } from '@/components/case/ChannelChain';
import { WearForecast } from '@/components/case/WearForecast';
import { Spectrum } from '@/components/case/Spectrum';
import { Posterior } from '@/components/decide/Posterior';
import { EvidenceList } from '@/components/decide/EvidenceList';
import { CostWindows } from '@/components/decide/CostWindows';
import { DecisionActions } from '@/components/decide/DecisionActions';

const LABELS = CHANNELS.map((c) => c.short);
const PAINT = { normal: '#6E7B86', watch: '#D99A00', act: '#C8372A', off: '#CDD1CA' } as const;
/** Chapters and the cards they span (0-based); scrolling through a chapter feeds those cards. */
const CHAPTERS = [
  { id: 'start', k: [N_PAST - 1, N_PAST - 1] },
  { id: 'card', k: [0, 9] },
  { id: 'normal', k: [9, 17] },
  { id: 'caught', k: [17, 25] },
  { id: 'spall', k: [25, 34] },
  { id: 'forecast', k: [34, 48] },
  { id: 'why', k: [48, 53] },
  { id: 'rupees', k: [53, 55] },
  { id: 'agents', k: [55, REPAIR_CARD] },
] as const;

export function Overview() {
  const model = getModel();
  const { loom, cost } = model;
  const fault = activeFault();
  const decision = useNaadi((s) => s.decision);
  const [k, setK] = useState(N_PAST - 1);
  const story = useRef<HTMLDivElement>(null);

  // scroll feeds the chain: the chapter crossing the reading line sets the card
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const line = window.innerHeight * 0.45;
      const secs = story.current?.querySelectorAll<HTMLElement>('[data-k0]') ?? [];
      let next = 0;
      for (const s of secs) {
        const r = s.getBoundingClientRect();
        const k0 = Number(s.dataset.k0), k1 = Number(s.dataset.k1);
        if (r.top <= line) next = r.bottom <= line ? k1 : Math.round(k0 + ((line - r.top) / r.height) * (k1 - k0));
      }
      setK(next);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, []);

  const kk = Math.min(k, N_PAST - 1);
  const at = asOf(loom, kk);

  return (
    <div className="story" ref={story}>
      <div className="story-reader">
        <RecordColumn m={loom} k={k} approved={decision === 'approved'} />
      </div>

      <div className="story-chapters">
        <section className="story-ch story-ch--start" data-k0={CHAPTERS[0].k[0]} data-k1={CHAPTERS[0].k[1]} aria-labelledby="h-start">
          <h1 id="h-start">Your loom has been telling you for weeks.</h1>
          <p className="lead">NAADI listens to every machine in a small factory, learns each one&apos;s normal, and punches a card every six hours. When the cards darken it says what is wrong, how long is left and what each repair window costs in rupees. The owner decides.</p>
          <div className="actions">
            <Link className="btn primary" href="/floor">Open the shed floor<Icon name="right" /></Link>
            <Link className="btn" href="/agents"><Icon name="play" />See the agents work</Link>
            <HearButton />
          </div>
          <ul className="facts">
            <li>No fault labels needed</li><li>Works offline</li><li>English · <span lang="hi">हिंदी</span> · <span lang="mr">मराठी</span></li><li>₹1,500 sensor, or a phone</li>
          </ul>
          <p className="story-hint"><Icon name="right" />Scroll, and the fortnight replays on the left from card 1, six hours to a row.</p>
        </section>

        <Chapter ch={1} title="One card every six hours" lede="Back to the start of the fortnight. Each card has eight hole positions, one for each thing NAADI measures. A hole means that channel left this loom's own normal during those six hours. Watch and act paint the whole card.">
          <BigCard k={kk} />
        </Chapter>

        <Chapter ch={2} title="It learns normal without a single fault label" lede="Nobody has a library of how this loom sounds before its bearing fails. So each machine learns its own normal from weeks of ordinary running, per load, and only departures from that punch a hole.">
          <div className="story-two">
            <LearnNormalFigure />
            <p className="sub">The tail threshold is set for about one false hole per channel in a hundred cards. Over this fortnight the six healthy machines collected <b>{model.machines.filter((m) => !m.prof).map((m) => m.cards.reduce((s, c) => s + c.n, 0)).join(', ')}</b> isolated holes each, about what that rate predicts, and none of them counts as evidence.</p>
          </div>
        </Chapter>

        <Chapter ch={3} title={`Card ${loom.ph!.onset + 1}: wear begins. Card ${loom.ph!.alarm + 1}: NAADI notices`} lede="A change-point test watches the trend of the holes and the degradation index, not single cards. It flagged the change before anyone on the floor heard anything.">
          <ChannelChain m={loom} approved={decision === 'approved'} at={at} />
        </Chapter>

        <Chapter ch={4} title={fault.bearing ? 'The envelope hears the bearing' : 'The spectrum hears the fault'} lede={`${fault.why} Card by card, that signature grows out of the floor${fault.family === 'bpfo' ? `, at ${(defectFactors().BPFO * model.measuredRpm / 60).toFixed(1)} Hz on this loom` : ''}.`}>
          <Spectrum spec={spectrumAt(loom, kk)} rpm={model.measuredRpm} callout={kk >= 24} />
        </Chapter>

        <Chapter ch={5} title={at.rul ? `On card ${kk + 1}, about ${at.rul.p50.toFixed(1)} days left` : 'How long it has'} lede="Once wear clears this loom's normal band, its growth rate is fitted and two thousand simulated futures give the time to failure. Each card sharpens the forecast; the dotted line is what happened next.">
          <WearForecast m={loom} at={at} />
        </Chapter>

        <Chapter ch={6} title="Why NAADI thinks it is the bearing" lede="Every rule in the rulebook carries a prior and a likelihood ratio for each kind of evidence. The ranking is plain Bayes, and every line cites its rule.">
          <div className="story-two">
            <Posterior rows={postAt(loom, kk)} limit={4} />
            <EvidenceList items={evidenceAt(loom, kk)} ids={evidenceAt(loom, kk).map((e) => e.id)} compact />
          </div>
        </Chapter>

        <Chapter ch={7} title="Same bearing, two bills" lede="The bearing will fail either way. What it costs depends on whether anyone knew a week early, and on choosing a window when the loom is idle anyway.">
          <div className="story-two">
            <div className="receipts receipts--tight">
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
                <p className="receipt-title">Fixed in Thursday&apos;s power cut</p>
                <dl>
                  <dt>{fault.part[0].toUpperCase() + fault.part.slice(1)}</dt><dd>{inr(fault.price)}</dd>
                  <dt>Technician, planned</dt><dd>{inr(fault.labour)}</dd>
                  <dt>Lost output (idle anyway)</dt><dd>₹0</dd>
                </dl>
                <p className="receipt-total"><span>Planned</span><b>{inr(cost.best.E)}</b></p>
              </div>
            </div>
            <div><CostWindows cost={cost} compact /><p className="fine">Chance of failing before Thursday: {pct(cost.best.F)}. Prices are this demo shed&apos;s.</p></div>
          </div>
        </Chapter>

        <Chapter ch={8} title="The agents prepare. You decide." lede="Seven agents call deterministic tools and draft the dealer's WhatsApp and the technician's hold. Both wait at your gate. Approve, and the repair card at the end of the chain is punched.">
          <AgentStrip />
          <div className="story-decide">
            <DecisionActions cost={cost} showFine={false} />
            <Link className="link" href="/agents">Watch the agents work, live<Icon name="right" /></Link>
          </div>
        </Chapter>

        <section className="story-end" aria-label="Ways in">
          <Link href="/floor" className="region door door--shed">
            <h2>The shed</h2>
            <p className="sub">Nine machines, two weeks of cards, a 3D twin you can replay and x-ray.</p>
            <MiniRecord />
            <span className="link">Open the shed<Icon name="right" /></span>
          </Link>
          <div className="region door">
            <h2>Try it on a fan</h2>
            <p className="sub">Scan with your phone, hold it to a running fan, teach it normal, then touch the fan.</p>
            <PhoneLink />
            <Link className="link" href="/lab">Or open the Live Lab here<Icon name="right" /></Link>
          </div>
          <Link href="/model" className="region door">
            <h2>How far to trust it</h2>
            <p className="sub">240 simulated bearings run to failure in your browser: warning time, calibration, false alarms, rupees, and where the forecast breaks.</p>
            <span className="link">Read the model card<Icon name="right" /></span>
          </Link>
          <footer className="foot">
            <p>NAADI · HackKumbh Nagpur · Track 4.3, Agentic AI. Every reading, name and price in this demo is synthetic; the physics and maths that turn them into decisions run live in your browser. <a className="link" href="https://github.com/vizsh/Naadi"><Icon name="github" />Code and maths</a></p>
          </footer>
        </section>
      </div>
    </div>
  );
}

function Chapter({ ch, title, lede, children }: { ch: number; title: string; lede: string; children: React.ReactNode }) {
  const c = CHAPTERS[ch];
  return (
    <section className="story-ch region" data-k0={c.k[0]} data-k1={c.k[1]} aria-label={title}>
      <h2>{title}</h2>
      <p className="sub">{lede}</p>
      <div className="story-fig">{children}</div>
    </section>
  );
}

function HearButton() {
  const [playing, setPlaying] = useState(false);
  return (
    <button type="button" className="btn" onClick={async () => { if (playing) { stop(); setPlaying(false); return; } setPlaying(true); await play(synth('now'), () => setPlaying(false)); }}>
      <Icon name={playing ? 'stop' : 'speaker'} />{playing ? 'Stop' : 'Hear Loom 03'}
    </button>
  );
}

/** The card under the head, large, with its eight positions named. */
function BigCard({ k }: { k: number }) {
  const { st } = useT();
  const c = getModel().loom.cards[k];
  const fill = c.off ? PAINT.off : PAINT[c.state];
  return (
    <figure className="big-card">
      <svg viewBox="0 0 640 170" role="img" aria-label={`Card ${k + 1}: ${c.off ? 'machine off' : CHANNELS.filter((_, i) => c.holes[i]).map((x) => x.short).join(', ') || 'no holes'}`}>
        <rect x="10" y="20" width="620" height="74" fill={fill} />
        {CHANNELS.map((ch, j) => {
          const x = 52 + j * 76;
          return (
            <g key={ch.id}>
              {c.holes[j] ? <circle cx={x} cy="57" r="13" fill="#17191C" /> : <circle cx={x} cy="57" r="13" fill="none" stroke="#F9FAF6" strokeOpacity=".55" strokeDasharray="3 3" />}
              <text x={x} y="122" className="t-row" textAnchor="middle">{ch.short}</text>
              <text x={x} y="140" className="t-cap" textAnchor="middle">{c.holes[j] ? 'left normal' : 'normal'}</text>
            </g>
          );
        })}
      </svg>
      <figcaption><StatusIcon state={c.off ? 'off' : c.state} /> <b>Card {k + 1}</b> · {cardLabel(k)} · {c.off ? 'machine off, not scored' : `${st(c.state)}, degradation ${c.dS.toFixed(3)}`}</figcaption>
    </figure>
  );
}

function LearnNormalFigure() {
  const pts = useMemo(() => {
    const r = mulberry32(5);
    return Array.from({ length: 90 }, () => { const a = gauss(r), b = gauss(r); return [a * 1.0 + b * 0.35, b * 0.62]; });
  }, []);
  const X = (v: number) => Math.round((150 + v * 40) * 100) / 100, Y = (v: number) => Math.round((96 - v * 40) * 100) / 100;
  return (
    <svg viewBox="0 0 300 190" className="step-fig step-fig--lg" role="img" aria-label="Normal readings form an ellipse; one reading falls outside and punches a hole">
      <ellipse cx={X(0)} cy={Y(0)} rx={2.9 * 40} ry={1.75 * 40} fill="none" stroke="#17191C" strokeDasharray="4 3" transform={`rotate(-12 ${X(0)} ${Y(0)})`} />
      {pts.map(([a, b], i) => <circle key={i} cx={X(a)} cy={Y(b)} r="2.6" fill="#6E7B86" />)}
      <circle cx={X(2.75)} cy={Y(1.8)} r="6" fill="#17191C" />
      <text x={X(2.75) - 10} y={Y(1.8) - 10} className="t-cap" textAnchor="end">outside normal: a hole</text>
    </svg>
  );
}

/** The run's ten calls as a strip of marks, gates last. */
function AgentStrip() {
  const model = getModel();
  const { scenario, useNote, decision } = useNaadi();
  const steps = planRun(model, { scenario, useNote, decision }).steps;
  return (
    <ol className="agent-strip">
      {steps.map((s, i) => (
        <li key={s.id + i} className={s.kind === 'gate' ? 'is-gate' : s.kind === 'human' ? 'is-human' : ''}>
          <b className="mono">{s.at.slice(3)}</b>
          <span>{s.agent}</span>
          <code>{s.call.split('(')[0].split(' ·')[0]}</code>
        </li>
      ))}
    </ol>
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
