'use client';
import Link from 'next/link';
import { N_PAST, inr } from '@/lib/model/core';
import type { NaadiModel } from '@/lib/model';
import { useNaadi } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Icon, StatusIcon } from '@/components/shell/Icons';
import { CostWindows } from '@/components/decide/CostWindows';
import { Posterior } from '@/components/decide/Posterior';
import { EvidenceList } from '@/components/decide/EvidenceList';
import { DecisionActions } from '@/components/decide/DecisionActions';
import { activeFault, activeShed, heroId, heroName } from '@/lib/model/setup';

export function DecisionPanel({ model }: { model: NaadiModel }) {
  const index = useNaadi((s) => s.index);
  const select = useNaadi((s) => s.select);
  const { t, parts, st, lang } = useT();
  const { cost } = model;
  const past = index < N_PAST - 1;
  const [a, b, c] = cost.best.id === 'thu' ? parts('dec').map((s) => s.replace('{hero}', heroName(lang))) : [`Repair ${heroName()}: `, cost.best.when, '.'];
  const nums = [inr(cost.best.E), inr(cost.unplanned)];
  const watch = (
    <>
      <h2 className="h-gap">{t('h.watch')}</h2>
      <ul className="watchlist">
        {Object.keys(activeShed().others).map((id) => {
          const m = model.byId[id];
          return (
            <li key={id}>
              <StatusIcon state={m.now.state} />
              <button type="button" onClick={() => select(id)}>{m.name} · {st(m.now.state)}</button>
              <p>{m.prof!.label}, {Math.round((m.prof!.p ?? 0) * 100)}% · {m.prof!.rule}</p>
              <p>{m.prof!.action}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
  if (model.quiet) {
    // a healthy fortnight: no forecast, no ranking, no bill, and nothing held at the gate
    const L = model.loom, holes = L.cards.reduce((n, c) => n + c.n, 0);
    return (
      <aside className="region decision" aria-labelledby="h-decision">
        <h2 id="h-decision">{t('h.decision')}</h2>
        <p className="status-line"><StatusIcon state={L.now.state} /><strong>{st(L.now.state)}</strong><span>{heroName()} · nothing to act on</span></p>
        <p className="decision-text">Nothing to repair. <strong>Keep running.</strong></p>
        <p className="decision-cost">In fourteen days {heroName()} punched {holes} isolated hole{holes === 1 ? '' : 's'}, about what the false-hole rate predicts, and the change-point test never fired. With no change there is no forecast, no ranking of causes and no bill, and no draft waits for your approval.</p>
        <Link className="link" href={`/machine/${heroId()}`}>Open {heroName()}&apos;s record<Icon name="right" /></Link>
        {watch}
      </aside>
    );
  }
  return (
    <aside className={`region decision${past ? ' is-past' : ''}`} aria-labelledby="h-decision">
      <h2 id="h-decision">{t('h.decision')}</h2>
      {past && <p className="past-note">Replaying card {index + 1}. The decision below is for card 56, now.</p>}
      <p className="status-line"><StatusIcon state={model.loom.now.state} /><strong>{st(model.loom.now.state)}</strong><span>{heroName()} · {activeFault().where}</span></p>
      <p className="decision-text">{a}<strong>{b}</strong>{c}</p>
      <p className="decision-cost">
        {parts('cost').map((p, i) => (p === '{a}' ? <strong key={i}>{nums[0]}</strong> : p === '{b}' ? <strong key={i}>{nums[1]}</strong> : <span key={i}>{p}</span>))}
      </p>
      <CostWindows cost={cost} compact />
      <DecisionActions cost={cost} />

      <h2 className="h-gap">{t('h.why')}</h2>
      <Posterior rows={model.post} limit={3} />
      <EvidenceList items={model.evidence} ids={model.evidence.slice(0, 3).map((e) => e.id)} compact />
      <Link className="link" href={`/machine/${heroId()}`}>{t('link.case')}<Icon name="right" /></Link>

      {watch}
    </aside>
  );
}
