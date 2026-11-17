'use client';
import { useState } from 'react';
import { getModel } from '@/lib/model';
import { CHANNELS } from '@/lib/model/shed';
import { useNaadi } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Icon } from '@/components/shell/Icons';
import { CardRecord } from '@/components/record/CardRecord';
import { ShedTwin } from '@/components/twin/ShedTwin';
import { Readout } from './Readout';
import { LiveBand, LiveReadout } from './LiveBand';
import { useLiveOnFloor } from '@/lib/lab/live';
import { ScrubBar } from './ScrubBar';
import { DecisionPanel } from './DecisionPanel';
import { MachineGrid } from './MachineGrid';

export function FloorView() {
  const model = getModel();
  const { index, selected, decision, rpm, setIndex, select } = useNaadi();
  const { t, st } = useT();
  const [table, setTable] = useState(false);
  const live = useLiveOnFloor();
  const m = model.byId[selected] ?? model.loom;
  return (
    <section className="view-floor" aria-labelledby="h-cards">
      <div className="region cards">
        <div className="region-head">
          <div>
            <h2 id="h-cards">{t('h.cards')}</h2>
            <p className="sub">{t('h.cards.sub')}</p>
          </div>
          <ul className="legend" aria-label="Legend">
            <li><svg className="sw" viewBox="0 0 10 10"><rect width="10" height="10" fill="#E2E6DD" /></svg>Normal card</li>
            <li><svg className="sw" viewBox="0 0 10 10"><rect width="10" height="10" fill="#E2E6DD" /><circle cx="5" cy="5" r="2.6" fill="#17191C" /></svg>Hole: a channel left normal</li>
            <li><svg className="sw" viewBox="0 0 10 10"><rect width="10" height="10" fill="var(--watch)" /></svg>Watch</li>
            <li><svg className="sw" viewBox="0 0 10 10"><rect width="10" height="10" fill="var(--act)" /></svg>Act</li>
            <li><svg className="sw" viewBox="0 0 10 10"><defs><pattern id="lg-h" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="#E9ECE4" /><path d="M0 0v3" stroke="#9BA19A" strokeWidth="1" /></pattern></defs><rect width="10" height="10" fill="url(#lg-h)" /></svg>Machine off</li>
            <li><svg className="sw" viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" fill="none" stroke="rgba(23,25,28,.4)" strokeDasharray="2 2" /></svg>Not yet punched</li>
          </ul>
          <button type="button" className="btn-quiet" aria-expanded={table} onClick={() => setTable(!table)}><Icon name="table" />Table</button>
        </div>
        <CardRecord machines={model.machines} index={index} selected={selected} approved={decision === 'approved'} rul={model.loom.rul} onSelect={select} />
        {live && <LiveBand selected={selected === 'LAB'} onSelect={() => select('LAB')} />}
        {table && (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Machine state at card 56</caption>
              <thead><tr><th>Machine</th><th>Now</th><th>Holes, last 4 cards</th><th className="num">Degradation</th><th>Reading</th></tr></thead>
              <tbody>
                {model.machines.map((x) => {
                  const recent = [...new Set(x.cards.slice(-4).flatMap((c) => CHANNELS.filter((_, i) => c.holes[i]).map((ch) => ch.short)))];
                  return (
                    <tr key={x.id}>
                      <td>{x.name}</td><td>{st(x.now.state)}</td><td>{recent.length ? recent.join(', ') : 'None'}</td>
                      <td className="num">{x.now.dS.toFixed(3)}</td><td>{x.prof ? x.prof.label : 'Inside its normal'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="floor-main">
        <ShedTwin machines={model.machines} index={index} selected={selected} shaftHz={(rpm ?? model.measuredRpm) / 60} onSelect={select} live={live}>
          {live && selected === 'LAB' ? <LiveReadout /> : <Readout m={m} index={index} />}
          <ScrubBar machines={model.machines} index={index} onIndex={setIndex} />
        </ShedTwin>
        <MachineGrid machines={model.machines} index={index} selected={selected} onSelect={select} />
      </div>
      <DecisionPanel model={model} />
    </section>
  );
}
