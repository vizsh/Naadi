'use client';
import Link from 'next/link';
import { ACT_AT, WATCH_AT, cardLabel } from '@/lib/model/core';
import { offReason, splitHoles, type Machine } from '@/lib/model/shed';
import type { Ranked } from '@/lib/model/decide';
import { useT } from '@/lib/i18n';
import { Icon, StatusIcon } from '@/components/shell/Icons';

/** The selected machine, summarised at the current card. */
export function Readout({ m, index, post }: { m: Machine; index: number; post: Ranked }) {
  const { t, st } = useT();
  const c = m.cards[index];
  const s = c.off ? 'off' : c.state;
  const { steady, isolated } = splitHoles(m, c.k);
  const names = steady.length ? steady : isolated;
  const holeCount = m.cards.slice(0, index + 1).reduce((a, x) => a + x.n, 0);
  return (
    <div className="readout" aria-live="polite">
      <div className="ro-head">
        <StatusIcon state={s} />
        {m.name}
        <span>· {st(s)}</span>
      </div>
      <p>Card {c.k + 1} of 56 · {cardLabel(c.k)}</p>
      <p>
        {c.off ? offReason(c.k) : names.length ? (
          <>Holes in <b>{names.join(', ')}</b>{steady.length > 0 && isolated.length > 0 ? ` · isolated: ${isolated.join(', ')}` : ''}</>
        ) : 'No holes: every channel inside its normal'}
      </p>
      {m.id === 'L03' ? (
        <p>Most likely <b>{post[0].name.toLowerCase()}</b>, {(post[0].p * 100).toFixed(1)}% · {post[0].id}</p>
      ) : m.prof ? (
        <p>Most likely <b>{m.prof.label.toLowerCase()}</b>, {Math.round((m.prof.p ?? 0) * 100)}% · {m.prof.rule}</p>
      ) : (
        <p>{holeCount ? `${holeCount} isolated hole${holeCount > 1 ? 's' : ''} so far, about what a 1% false-hole rate predicts.` : 'No holes so far this fortnight.'}</p>
      )}
      <p>Degradation index <b className="mono">{c.dS.toFixed(3)}</b> · watch at {WATCH_AT}, act at {ACT_AT}</p>
      <Link className="link" href={`/machine/${m.id}`}>{m.id === 'L03' ? t('link.case') : `Open ${m.name}'s record`}<Icon name="right" /></Link>
    </div>
  );
}
