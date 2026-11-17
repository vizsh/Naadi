'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CHANNELS, getLabEngine, type Snapshot } from '@/lib/lab/engine';
import { stopLive } from '@/lib/lab/live';
import { wireAutosave } from '@/lib/lab/sessions';
import { SavedSessions } from './SavedSessions';
import { useMounted, useWidth } from '@/lib/hooks';
import { useNaadi } from '@/lib/store';
import { Icon, StatusIcon } from '@/components/shell/Icons';

const FILL = { normal: '#E2E6DD', watch: 'var(--watch)', act: 'var(--act)' } as const;
const EMPTY: Snapshot = { phase: 'idle', source: null, learnProgress: 0, d2: 0, threshold: 0, history: [], cards: [], changed: [], fault: false, level: -100, motion: null, error: null };
const hz = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} kHz` : `${Math.round(f)} Hz`);

function hint(lo: number, hi: number) {
  if (lo >= 1800) return 'high-frequency ringing, the kind impacts make: bearing spalls, cavitation, rubbing';
  if (hi <= 320) return 'low-frequency rise: unbalance, looseness or a change of load';
  return 'mid-band rise: blade pass, belt, gear mesh or electrical hum';
}

export function LiveLab() {
  // one engine per tab: it keeps running while its machine stands on the shed floor
  const [e] = useState(getLabEngine);
  const onFloor = useNaadi((s) => s.labOnFloor);
  const setOnFloor = useNaadi((s) => s.setLabOnFloor);
  const spec = useRef<HTMLCanvasElement>(null);
  const fall = useRef<HTMLCanvasElement>(null);
  const mounted = useMounted();
  const ready = mounted;
  const motionAvailable = mounted && 'DeviceMotionEvent' in window && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  useEffect(() => {
    wireAutosave(e);
    e.attach(spec.current, fall.current);
    return () => {
      e.attach(null, null);
      // leaving the Lab without placing the machine releases the microphone
      if (!useNaadi.getState().labOnFloor) void e.reset();
    };
  }, [e]);
  const subscribe = useCallback((cb: () => void) => e.subscribe(cb), [e]);
  const snap = useSyncExternalStore(subscribe, () => e.snap, () => EMPTY);
  const live = snap.phase !== 'idle';
  const over = snap.phase === 'watching' && snap.d2 > snap.threshold;
  const last = snap.cards[snap.cards.length - 1];
  const state = snap.phase !== 'watching' ? null : last?.state ?? 'normal';

  return (
    <section className="view-lab" aria-labelledby="lab-title">
      <div className="region lab-head">
        <div>
          <h1 id="lab-title">Live Lab: your phone is the sensor</h1>
          <p className="sub">Hold your phone or laptop against a running fan, motor or pump, or use the synthesised fan. NAADI learns that machine&apos;s normal in 20 seconds, then punches a card every two seconds. Audio is analysed in this tab and never leaves the device.</p>
        </div>
        <div className="lab-controls">
          <div className="actions">
            <button type="button" className={`btn${snap.source === 'mic' ? ' primary' : ''}`} disabled={!ready} onClick={() => e?.start('mic')}><Icon name="mic" />Use the microphone</button>
            <button type="button" className={`btn${snap.source === 'demo' ? ' primary' : ''}`} disabled={!ready} onClick={() => e?.start('demo')}><Icon name="speaker" />Use a synthesised fan</button>
            {motionAvailable && <button type="button" className="btn" onClick={() => e?.enableMotion()}><Icon name="phone" />Add the motion sensor</button>}
          </div>
          <div className="actions">
            <button type="button" className="btn" disabled={!live || snap.phase === 'learning'} onClick={() => e?.learn()}>
              {snap.phase === 'learning' ? `Learning normal · ${Math.round(snap.learnProgress * 20)} s of 20` : snap.phase === 'watching' ? 'Learn normal again' : 'Learn normal · 20 s'}
            </button>
            {snap.source === 'demo' && (
              <button type="button" className="btn" aria-pressed={snap.fault} disabled={snap.phase !== 'watching'} onClick={() => e?.setFault(!snap.fault)}>
                <Icon name="wrench" />{snap.fault ? 'Remove the fault' : 'Add a bearing fault'}
              </button>
            )}
            {live && <button type="button" className="btn-quiet" onClick={stopLive}>Stop</button>}
          </div>
          {snap.phase === 'watching' && (
            <div className="actions lab-floor">
              {onFloor ? (
                <>
                  <span className="done"><Icon name="check" /> On the shed floor as a tenth machine</span>
                  <Link className="link" href="/floor">See it on the floor<Icon name="right" /></Link>
                  <button type="button" className="btn-quiet" onClick={() => setOnFloor(false)}>Take it off</button>
                </>
              ) : (
                <button type="button" className="btn primary" onClick={() => setOnFloor(true)}><Icon name="spark" />Put it on the shed floor</button>
              )}
            </div>
          )}
        </div>
        <p className="lab-status" aria-live="polite">
          {snap.error ? <>Could not open the microphone: {snap.error}. Try the synthesised fan.</>
            : snap.phase === 'idle' ? <>Choose a sensor to begin.</>
            : snap.phase === 'listening' ? <>Listening. Press <b>Learn normal</b> while the machine runs as it usually does.</>
            : snap.phase === 'learning' ? <>Learning this machine&apos;s normal… keep it running as usual.</>
            : <>{state && <StatusIcon state={state} />} Watching. A card is punched every two seconds{snap.source === 'demo' && !snap.fault ? '; now press Add a bearing fault' : ''}.{onFloor ? ' Its chain is also hanging on the shed floor; the sensor keeps listening until you stop it.' : ''}</>}
        </p>
        {snap.phase === 'learning' && <div className="lab-progress" aria-hidden="true"><i style={{ width: `${snap.learnProgress * 100}%` }} /></div>}
      </div>

      <div className="lab-grid">
        <div className="region lab-spec">
          <div className="region-head">
            <div><h2>Spectrum, live</h2><p className="sub">Log frequency, 60 Hz to 8 kHz. Ink is now; grey is the normal you taught it.</p></div>
            <ul className="legend"><li><svg className="sw-line" viewBox="0 0 18 10"><path d="M0 5h18" stroke="#17191C" strokeWidth="2" /></svg>Now</li><li><svg className="sw-line" viewBox="0 0 18 10"><path d="M0 5h18" stroke="#80837B" strokeWidth="2" /></svg>Your normal</li></ul>
          </div>
          <div className="lab-canvas-wrap">
            <canvas ref={spec} className="lab-canvas" aria-label="Live spectrum" />
            {snap.phase === 'idle' && (
              <ol className="lab-idle">
                <li><b>1</b><span><strong>Choose a sensor.</strong> Your microphone held against a running fan, motor or pump, or the synthesised fan if the room is silent.</span></li>
                <li><b>2</b><span><strong>Learn normal for 20 seconds.</strong> 400 frames of 21 features; NAADI fits a mean, a shrunk covariance and a threshold from your own machine.</span></li>
                <li><b>3</b><span><strong>Watch the cards.</strong> One every two seconds. Touch the fan guard, or add a bearing fault, and holes punch as the distance crosses its threshold.</span></li>
              </ol>
            )}
            <div className="lab-ticks" aria-hidden="true">{[100, 200, 500, 1000, 2000, 5000].map((f) => <span key={f} style={{ left: `${(Math.log(f / 60) / Math.log(8000 / 60)) * 100}%` }}>{hz(f)}</span>)}</div>
          </div>
        </div>
        <div className="region lab-score">
          <h2>How unusual</h2>
          <p className="sub">Mahalanobis distance of every frame from your normal, against a threshold set by that normal.</p>
          <div className={`lab-meter${over ? ' is-over' : ''}`}>
            <span className="lab-d2">{snap.phase === 'watching' ? snap.d2.toFixed(1) : '—'}</span>
            <span className="lab-thr">threshold {snap.phase === 'watching' ? snap.threshold.toFixed(1) : '—'}</span>
            {state && <span className="lab-state"><StatusIcon state={state} />{state === 'act' ? 'Act' : state === 'watch' ? 'Watch' : 'Normal'}</span>}
          </div>
          <ScoreHistory history={snap.history} threshold={snap.threshold} />
          {snap.phase !== 'watching' && <p className="fine">Each frame becomes 21 numbers, standardised against your normal: <i>D² = zᵀ Σ̂⁻¹ z</i>, with Σ̂ shrunk toward the identity by Ledoit–Wolf. The threshold is 1.25 × the 99.5th percentile of your own normal frames, so it is set by your machine, not by us.</p>}
          {snap.phase === 'watching' && e && <p className="fine">Fitted on 400 frames: 21 features, Ledoit–Wolf shrinkage α = {e.lw.toFixed(2)}. Threshold = 1.25 × the 99.5th percentile of your own normal.</p>}
          {snap.motion && <p className="fine">Motion sensor: {snap.motion.rms.toFixed(3)} m/s² RMS, strongest at {snap.motion.hz.toFixed(1)} Hz.</p>}
        </div>
        <div className="region lab-fall">
          <h2>Waterfall</h2>
          <p className="sub">Time runs right to left; darker means louder at that frequency.</p>
          <canvas ref={fall} className="lab-canvas lab-canvas--fall" aria-label="Spectrogram waterfall" />
        </div>
        <div className="region lab-cards">
          <h2>Cards, punched live</h2>
          <p className="sub">One card every two seconds. A hole when a channel stays more than 3.5 standard deviations from your normal for 30% of the card.</p>
          <LiveCards snap={snap} />
        </div>
        <div className="region lab-changed">
          <h2>What changed</h2>
          {snap.phase !== 'watching' ? (
            <>
              <p className="sub">Once it knows your normal, the bands that moved most show here. Until then, what the eight hole positions on each card mean:</p>
              <dl className="lab-gloss">
                {[['Level', 'overall loudness'], ['Impulse', 'crest and kurtosis: knocks and impacts'], ['Low', '60–200 Hz: unbalance, looseness'], ['Low-mid', '200–600 Hz: blade pass, belts'], ['Mid', '0.6–2 kHz: gears, hum harmonics'], ['High', '2–8 kHz: bearings, cavitation, rubbing'], ['Tonality', 'flatness: a tone rising out of noise'], ['Brightness', 'spectral centroid moving up or down']].map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}
              </dl>
            </>
          )
            : snap.changed.length === 0 ? <p className="sub">Nothing has moved more than 3 dB from normal.</p>
            : (
              <ul className="changed">
                {snap.changed.map((c) => (
                  <li key={c.lo}>
                    <b className="mono">+{c.db.toFixed(1)} dB</b>
                    <span>{hz(c.lo)}–{hz(c.hi)}</span>
                    <span className="sub">{hint(c.lo, c.hi)}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <SavedSessions watching={snap.phase === 'watching'} />
      </div>
    </section>
  );
}

function ScoreHistory({ history, threshold }: { history: number[]; threshold: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 360;
  const H = 120;
  const max = Math.max(threshold * 6, ...history, 10);
  const Y = (v: number) => H - 4 - (Math.log10(Math.max(1, v)) / Math.log10(max)) * (H - 10);
  const pts = history.map((v, i) => `${((i + 240 - history.length) / 239) * W},${Y(v)}`).join(' ');
  return (
    <div ref={wrap} className="lab-hist">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Distance over the last 12 seconds">
        {[1, 10, 100, 1000].filter((v) => v <= max).map((v) => <line key={v} x1={0} x2={W} y1={Y(v)} y2={Y(v)} stroke="rgba(64,108,98,.16)" />)}
        {threshold > 0 && <line x1={0} x2={W} y1={Y(threshold)} y2={Y(threshold)} stroke="var(--act)" strokeWidth="1.25" />}
        {history.length > 1 && <polyline points={pts} fill="none" stroke="var(--ink)" strokeWidth="1.5" />}
      </svg>
    </div>
  );
}

function LiveCards({ snap }: { snap: Snapshot }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 900;
  const labelW = 86;
  const n = Math.max(48, Math.floor((W - labelW) / 18));
  const pitch = Math.max(8, Math.min(18, Math.floor((W - labelW) / n)));
  const cell = pitch - 3, row = cell + 4, top = 10;
  const H = top + 6 + CHANNELS.length * row + 6;
  const cards = snap.cards;
  return (
    <div ref={wrap} className="scroll-x">
      <svg width={Math.max(W, labelW + n * pitch)} height={H} role="img" aria-label="Live card chain">
        {CHANNELS.map((c, i) => <text key={c} x="0" y={top + 6 + i * row + cell / 2 + 4} className="t-row">{c}</text>)}
        {Array.from({ length: n }, (_, j) => {
          const card = cards[cards.length - n + j];
          const x = labelW + j * pitch;
          return (
            <g key={j}>
              <rect x={x} y={top - 2} width={cell} height={4} fill={card ? FILL[card.state] : 'none'} />
              {CHANNELS.map((_, i) => {
                const y = top + 6 + i * row;
                return card ? (
                  <g key={i}>
                    <rect x={x} y={y} width={cell} height={cell} fill="#E2E6DD" />
                    {card.holes[i] && <circle cx={x + cell / 2} cy={y + cell / 2} r={cell * 0.32} fill="var(--ink)" />}
                  </g>
                ) : (
                  <rect key={i} x={x + 0.5} y={y + 0.5} width={cell - 1} height={cell - 1} className="c-blank" />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
