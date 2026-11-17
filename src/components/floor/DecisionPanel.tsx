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
import { activeFault } from '@/lib/model/setup';

export function DecisionPanel({ model }: { model: NaadiModel }) {
  const index = useNaadi((s) => s.index);
  const select = useNaadi((s) => s.select);
  const { t, parts, st } = useT();
  const { cost } = model;
  const past = index < N_PAST - 1;
  const [a, b, c] = cost.best.id === 'thu' ? parts('dec') : ['Repair Loom 03: ', cost.best.when, '.'];
  const nums = [inr(cost.best.E), inr(cost.unplanned)];
  return (
    <aside className={`region decision${past ? ' is-past' : ''}`} aria-labelledby="h-decision">
      <h2 id="h-decision">{t('h.decision')}</h2>
      {past && <p className="past-note">Replaying card {index + 1}. The decision below is for card 56, now.</p>}
      <p className="status-line"><StatusIcon state={model.loom.now.state} /><strong>{st(model.loom.now.state)}</strong><span>Loom 03 · {activeFault().where}</span></p>
      <p className="decision-text">{a}<strong>{b}</strong>{c}</p>
      <p className="decision-cost">
        {parts('cost').map((p, i) => (p === '{a}' ? <strong key={i}>{nums[0]}</strong> : p === '{b}' ? <strong key={i}>{nums[1]}</strong> : <span key={i}>{p}</span>))}
      </p>
      <CostWindows cost={cost} compact />
      <DecisionActions cost={cost} />

      <h2 className="h-gap">{t('h.why')}</h2>
      <Posterior rows={model.post} limit={3} />
      <EvidenceList items={model.evidence} ids={model.evidence.slice(0, 3).map((e) => e.id)} compact />
      <Link className="link" href="/machine/L03">{t('link.case')}<Icon name="right" /></Link>

      <h2 className="h-gap">{t('h.watch')}</h2>
      <ul className="watchlist">
        {['P02', 'L05'].map((id) => {
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
    </aside>
  );
}
