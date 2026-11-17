'use client';
import Link from 'next/link';
import { useState } from 'react';
import { getModel, type NaadiModel } from '@/lib/model';
import { N_PAST, cardLabel, inr, pct } from '@/lib/model/core';
import { defectFactors, BEARING, cursorFit, spectrumFacts, toneTable } from '@/lib/model/physics';
import { COST, NOTES } from '@/lib/model/decide';
import { asOf, evidenceAt, postAt, spectrumAt, type AsOf } from '@/lib/model/replay';
import { ScrubBar } from '@/components/floor/ScrubBar';
import { planRun } from '@/lib/agents/pipeline';
import { useNaadi } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Icon, StatusIcon } from '@/components/shell/Icons';
import { CostWindows } from '@/components/decide/CostWindows';
import { Posterior } from '@/components/decide/Posterior';
import { EvidenceList } from '@/components/decide/EvidenceList';
import { DecisionActions } from '@/components/decide/DecisionActions';
import { Spectrum } from './Spectrum';
import { BearingSection } from './BearingSection';
import { ChannelChain } from './ChannelChain';
import { WearForecast } from './WearForecast';
import { Listen } from './Listen';
import { AgentTrace } from './AgentTrace';

export function CaseFile({ id }: { id: string }) {
  const model = getModel();
  const m = model.byId[id];
  const { t, st } = useT();
  const decision = useNaadi((s) => s.decision);
  const index = useNaadi((s) => s.index);
  const setIndex = useNaadi((s) => s.setIndex);
  if (id !== 'L03') return <OtherMachine id={id} />;
  const { cost, post, postNoNote, loom } = model;
  const r = loom.rul!, fit = loom.fit!;
  const run = planRun(model, { scenario: { powerCut: true, partInStock: true }, useNote: true, decision });
  const at = asOf(loom, index);
  const replay = index < N_PAST - 1;
  const postK = postAt(loom, index);
  const evK = evidenceAt(loom, index);
  const noteIn = index >= NOTES[0].k;
  return (
    <section className="view-case" aria-labelledby="case-title">
      <div className="region case-head">
        <div>
          <Link className="link back" href="/floor"><Icon name="left" />{t('nav.floor')}</Link>
          <h1 id="case-title">Loom 03 · motor drive-end bearing 6205-2RS</h1>
          <p className="status-line">
            <StatusIcon state="act" /><strong>{st('act')}</strong>
            <span>{post[0].name}, {(post[0].p * 100).toFixed(1)}% · fails within 7 days: {pct(r.cdf(7))} · repairing Thursday saves {inr(cost.saving)}</span>
          </p>
        </div>
        <div className="case-actions"><DecisionActions cost={cost} showFine={false} /></div>
      </div>
      <div className="region case-replay" aria-label="Replay this case card by card">
        <ScrubBar machines={[loom]} index={index} onIndex={setIndex} inline />
        <ReplayLine at={at} post={postK} />
      </div>
      <div className="case-grid">
        <SpectrumRegion model={model} at={at} />
        <div className="region bear">
          <h2>Why that frequency</h2>
          <p className="sub">A section through the 6205, to scale, slowed 40 times. Each tick on the strip is a ball rolling over the spall.</p>
          <BearingRegion model={model} severity={at.severity} />
          <h3>Hear it</h3>
          <Listen />
        </div>
        <div className="region chain">
          <div className="region-head"><div>
            <h2>Loom 03, channel by channel</h2>
            <p className="sub">Each column is one card; each row is one of the eight channels NAADI scores. The coloured edge is the card&apos;s state.</p>
          </div></div>
          <ChannelChain m={m} approved={decision === 'approved'} noteK={NOTES[0].k} at={at} />
        </div>
        <div className="region rul">
          <div className="region-head">
            <div>
              <h2>Wear and time to failure{replay ? `, as known at card ${index + 1}` : ''}</h2>
              <p className="sub">{replay
                ? (at.rul ? `The forecast made from cards 1–${index + 1}. The dotted line is what was recorded afterwards, which this forecast had not seen.` : at.ph ? `Change detected at card ${at.ph.alarm + 1}; the growth fit waits for four cards clear of this loom's normal band.` : `Nothing has left this loom's normal yet, so there is nothing to forecast.`)
                : 'Degradation index on a log scale, where steady exponential wear draws a straight line.'}</p>
            </div>
            <ul className="legend" aria-label="Legend">
              <li><svg className="sw-line" viewBox="0 0 18 10"><path d="M0 5h18" stroke="#17191C" strokeWidth="2" /></svg>Measured</li>
              {replay && <li><svg className="sw-line" viewBox="0 0 18 10"><path d="M1 5h16" stroke="#80837B" strokeWidth="1.5" strokeDasharray="1.5 3" strokeLinecap="round" /></svg>Recorded later</li>}
              <li><svg className="sw-line" viewBox="0 0 18 10"><path d="M0 5h18" stroke="#17191C" strokeWidth="1.5" strokeDasharray="5 3" /></svg>Median forecast</li>
              <li><svg className="sw" viewBox="0 0 10 10"><rect width="10" height="10" fill="rgba(86,98,108,.22)" /></svg>P10–P90 forecast</li>
            </ul>
          </div>
          <WearForecast m={m} repairT={cost.best.t === Infinity ? undefined : cost.best.t} at={at} />
          {at.fit && at.rul ? (
            <p className="fine">Growth rate fitted by least squares on {at.fit.n} cards from card {at.fitFrom! + 1}, the first clear of this loom&apos;s normal band: b = {at.fit.b.toFixed(3)} ± {at.fit.se.toFixed(3)} per day. Time to failure P10 {at.rul.p10.toFixed(1)} d · P50 {at.rul.p50.toFixed(1)} d · P90 {at.rul.p90.toFixed(1)} d. The fan widens the fit&apos;s error for smoothing and adds a ±15% prior on how wear accelerates, as tuned on the <Link href="/model">model card</Link>.</p>
          ) : (
            <p className="fine">Today&apos;s fit, for comparison: b = {fit.b.toFixed(3)} ± {fit.se.toFixed(3)} per day, P50 {r.p50.toFixed(1)} days.</p>
          )}
        </div>
        <div className="region why">
          <h2>Ranked causes{replay ? `, card ${index + 1}` : ''}</h2>
          <p className="sub">{at.diagnosing
            ? 'Prior from loom-motor failures, multiplied by each rule\u2019s likelihood ratio, then normalised.'
            : `No diagnosis yet on card ${index + 1}: nothing has left this loom's normal, so the ranking is the rulebook's prior.`}</p>
          <div className={at.diagnosing ? undefined : 'is-prior'}><Posterior rows={postK} /></div>
          <h3>Evidence{replay ? `, card ${index + 1}` : ''}</h3>
          {evK.length ? <EvidenceList items={evK} ids={evK.map((e) => e.id)} /> : <p className="sub">None yet. A channel counts as evidence once it is punched on two of its last six cards.</p>}
          {noteIn ? (
            <figure className="note">
              <figcaption><Icon name="note" /><strong>Sunita K.</strong><span>weaver · voice note · 09:42</span></figcaption>
              <blockquote lang="mr">{NOTES[0].mr}</blockquote>
              <p>“There is a knocking sound.” Counted as BRG-OR-01 · e3, likelihood ratio 1.8. Without it the outer-race posterior was {(postNoNote[0].p * 100).toFixed(1)}%; with it, {(post[0].p * 100).toFixed(1)}%.</p>
            </figure>
          ) : <p className="fine">Sunita K.&apos;s voice note arrives on card {NOTES[0].k + 1}.</p>}
        </div>
        <div className="region cost">
          <h2>What each repair window costs</h2>
          <p className="sub">Expected cost = chance it fails first × the breakdown bill, plus the planned bill otherwise.</p>
          {replay && <p className="past-note">Priced at card 56, today. The replay changes the evidence and the forecast above, not today&apos;s bill.</p>}
          <CostWindows cost={cost} />
          <p className="formula">E[cost of window t] = F(t) × {inr(cost.unplanned)} + (1 − F(t)) × ({inr(cost.planned)} + lost output), with F(t) from {r.n.toLocaleString('en-IN')} Monte Carlo runs.</p>
          <table className="breakdown">
            <tbody>
              <tr><td>Lost output: {COST.downtimeH} h × {inr(cost.perH)}/h (margin {inr(COST.marginH)} + idle wages {inr(COST.wagesH)})</td><td className="num">{inr(cost.parts.downtime)}</td></tr>
              <tr><td>Rush part: 6205-2RS at {inr(COST.part)} + {COST.premium * 100}%</td><td className="num">{inr(cost.parts.part)}</td></tr>
              <tr><td>Emergency call-out</td><td className="num">{inr(cost.parts.callout)}</td></tr>
              <tr><td>Secondary damage: {COST.pSecondary * 100}% × {inr(COST.secondary)} (shaft, housing)</td><td className="num">{inr(cost.parts.secondary)}</td></tr>
              <tr className="total"><td>Breakdown bill</td><td className="num">{inr(cost.unplanned)}</td></tr>
              <tr><td>Planned bill: part {inr(COST.part)} + labour {inr(COST.labour)}</td><td className="num">{inr(cost.planned)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="region trace">
          <div className="region-head"><div>
            <h2>How the agents got here</h2>
            <p className="sub">Every number above came from a deterministic tool; the agents chose which tools to call and wrote the drafts. Nothing outward goes out without the owner.</p>
          </div>
          <Link className="link" href="/agents">Run the agents with what-ifs<Icon name="right" /></Link></div>
          <AgentTrace steps={run.steps} />
        </div>
      </div>
    </section>
  );

}

function SpectrumRegion({ model, at }: { model: NaadiModel; at: AsOf }) {
  const spec = spectrumAt(model.loom, at.k);
  const rpmState = useNaadi((s) => s.rpm);
  const setRpm = useNaadi((s) => s.setRpm);
  const [table, setTable] = useState(false);
  const rpm = rpmState ?? model.measuredRpm;
  const fr = rpm / 60;
  const f = cursorFit(spec, rpm);
  const fMeasured = cursorFit(spec, model.measuredRpm);
  const card = at.scored.k + 1;
  const facts = spectrumFacts(spec);
  return (
    <div className="region spec">
      <div className="region-head">
        <div>
          <h2>Envelope spectrum, card {card}</h2>
          <p className="sub">{at.scored.k !== at.k ? `The loom was off on card ${at.k + 1}; this is card ${card}, the last one scored. ` : ''}What the drive-end accelerometer heard after demodulation, against this loom&apos;s own healthy first week.</p>
        </div>
        <ul className="legend" aria-label="Legend">
          <li><svg className="sw-line" viewBox="0 0 18 10"><path d="M0 5h18" stroke="#17191C" strokeWidth="2" /></svg>Card {card}</li>
          <li><svg className="sw-line" viewBox="0 0 18 10"><path d="M0 5h18" stroke="#80837B" strokeWidth="2" /></svg>Baseline, first week</li>
          <li><svg className="sw-line" viewBox="0 0 18 10"><path d="M9 0v10" stroke="var(--act)" strokeWidth="1.5" /></svg>BPFO family at this speed</li>
          <li><svg className="sw-line" viewBox="0 0 18 10"><path d="M9 0v10" stroke="#656B72" strokeWidth="1.2" strokeDasharray="2 2" /></svg>Other bearing tones</li>
        </ul>
        <button type="button" className="btn-quiet" aria-expanded={table} onClick={() => setTable(!table)}><Icon name="table" />Table</button>
      </div>
      <Spectrum spec={spec} rpm={rpm} callout={facts.overBase >= 3} />
      <div className="speed">
        <label htmlFor="rpm">Shaft speed</label>
        <input id="rpm" type="range" min={1300} max={1560} step={1} value={rpm} onChange={(e) => setRpm(Number(e.target.value))} />
        <output className="mono" htmlFor="rpm">{rpm.toLocaleString('en-IN')} rpm · {fr.toFixed(2)} Hz{rpm === model.measuredRpm ? ' · measured' : ''}</output>
        <button type="button" className="btn-quiet" onClick={() => setRpm(model.measuredRpm)}>Use the speed measured from the 1× peak</button>
      </div>
      <p className="fit" aria-live="polite">
        {fMeasured < 4 ? <>On card {card} the envelope is flat at the outer-race tones: <b>{f.toFixed(1)} dB</b> above the local floor. There is nothing for the physics to explain yet.</>
          : f > 0.65 * fMeasured ? <>At these cursors the BPFO family stands <b>{f.toFixed(1)} dB</b> above the local floor: the peaks sit exactly on the outer-race tones.</>
          : <>Only <b>{f.toFixed(1)} dB</b> at these cursors: at {rpm.toLocaleString('en-IN')} rpm the outer-race tones miss the measured peaks. Speed has to be right before the physics can speak.</>}
      </p>
      {table && (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Bearing tones at the selected speed</caption>
            <thead><tr><th>Tone</th><th className="num">Hz</th><th className="num">Now, dB over floor</th><th className="num">Baseline, dB over floor</th></tr></thead>
            <tbody>{toneTable(spec, rpm).map((row) => <tr key={row.name}><td>{row.name}</td><td className="num">{row.hz.toFixed(1)}</td><td className="num">{row.now.toFixed(1)}</td><td className="num">{row.base.toFixed(1)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BearingRegion({ model, severity }: { model: NaadiModel; severity: number }) {
  const rpm = useNaadi((s) => s.rpm) ?? model.measuredRpm;
  const F = defectFactors(), fr = rpm / 60;
  const row = (k: string, v: React.ReactNode, main = false) => (
    <><dt className={main ? 'is-main' : ''}>{k}</dt><dd className={main ? 'is-main' : ''}>{v}</dd></>
  );
  return (
    <>
      <BearingSection rpm={rpm} severity={severity} />
      <dl className="freqs">
        {row('Shaft', `${rpm} rpm ÷ 60 = ${fr.toFixed(2)} Hz`)}
        {row('FTF', `${F.FTF.toFixed(3)} × fr = ${(F.FTF * fr).toFixed(2)} Hz`)}
        {row('BSF', `${F.BSF.toFixed(3)} × fr = ${(F.BSF * fr).toFixed(1)} Hz`)}
        {row('BPFO', <>{F.BPFO.toFixed(3)} × fr = <b>{(F.BPFO * fr).toFixed(1)} Hz</b></>, true)}
        {row('BPFI', `${F.BPFI.toFixed(3)} × fr = ${(F.BPFI * fr).toFixed(1)} Hz`)}
        {row('Geometry', `n = ${BEARING.n} balls, d/D = ${F.ratio.toFixed(3)}, BPFO = (n/2)(1 − d/D)·fr`)}
      </dl>
    </>
  );
}

/** One line under the replay scrub: the state of the case at the replayed card. */
function ReplayLine({ at, post }: { at: AsOf; post: ReturnType<typeof postAt> }) {
  const { st } = useT();
  const s = at.scored.state;
  const parts: string[] = [`degradation ${at.scored.dS.toFixed(3)}`];
  if (at.ph) parts.push(`change detected at card ${at.ph.alarm + 1}`);
  if (at.diagnosing && post.length) parts.push(`${post[0].name.toLowerCase()} ${(post[0].p * 100).toFixed(1)}%`);
  if (at.rul) parts.push(`time to failure P50 ${at.rul.p50.toFixed(1)} d`);
  return (
    <p className="replay-line" aria-live="polite">
      <StatusIcon state={s} /><strong>{st(s)}</strong>
      <span>{at.k < N_PAST - 1 ? `As known at the end of ${cardLabel(at.k)}` : 'Now, card 56'} · {parts.join(' · ')}</span>
    </p>
  );
}

function OtherMachine({ id }: { id: string }) {
  const model = getModel();
  const m = model.byId[id];
  const { t, st } = useT();
  const index = useNaadi((s) => s.index);
  const setIndex = useNaadi((s) => s.setIndex);
  const at = asOf(m, index);
  const holes = m.cards.reduce((a, c) => a + c.n, 0);
  return (
    <section className="view-case" aria-labelledby="case-title">
      <div className="region case-head">
        <div>
          <Link className="link back" href="/floor"><Icon name="left" />{t('nav.floor')}</Link>
          <h1 id="case-title">{m.name} · {m.nameplate}</h1>
          <p className="status-line">
            <StatusIcon state={m.now.state} /><strong>{st(m.now.state)}</strong>
            <span>{m.prof ? `${m.prof.label}, ${Math.round((m.prof.p ?? 0) * 100)}% · ${m.prof.rule}` : `${holes} isolated hole${holes === 1 ? '' : 's'} in 14 days, inside the 1% false-hole budget`}</span>
          </p>
        </div>
        <Link className="link" href="/machine/L03">Loom 03 is the one to act on<Icon name="right" /></Link>
      </div>
      <div className="region case-replay" aria-label="Replay this record card by card">
        <ScrubBar machines={[m]} index={index} onIndex={setIndex} inline />
        <ReplayLine at={at} post={[]} />
      </div>
      <div className="case-grid case-grid--simple">
        <div className="region chain">
          <div className="region-head"><div>
            <h2>{m.name}, channel by channel</h2>
            <p className="sub">Each column is one card; each row is one of the eight channels NAADI scores.</p>
          </div></div>
          <ChannelChain m={m} approved={false} at={at} />
        </div>
        <div className="region rul">
          <h2>Wear{m.rul ? ' and time to failure' : ''}</h2>
          <p className="sub">{m.rul ? `Change detected at card ${m.ph!.alarm + 1}; time to failure P50 ${m.rul.p50.toFixed(1)} days (P10 ${m.rul.p10.toFixed(1)}, P90 ${m.rul.p90.toFixed(1)}).` : 'Flat and well under the watch level: nothing is wearing faster than the machine’s own normal.'}</p>
          <WearForecast m={m} at={at} />
        </div>
        <div className="region why">
          <h2>{m.prof ? 'What NAADI recommends' : 'Nothing to act on'}</h2>
          {m.prof ? (
            <>
              <p className="decision-text">{m.prof.action}</p>
              <p className="sub">{m.prof.label} is the leading cause at {Math.round((m.prof.p ?? 0) * 100)}% under rule {m.prof.rule}. {id === 'P02' ? 'Cavitation shows as broadband sound above 2 kHz and a fluttering current, so the envelope spectrum is not the right lens here; the sound and current channels are.' : 'Belt slip shows at shaft rate and in the motor current, which is why the 1× and current channels carry its holes.'}</p>
            </>
          ) : (
            <p className="sub">Every channel stayed inside its learned band, apart from {holes} isolated hole{holes === 1 ? '' : 's'} over {N_PAST} cards. The tail threshold is tuned for about 1% false holes per channel, so this is what healthy looks like.</p>
          )}
        </div>
      </div>
    </section>
  );
}
