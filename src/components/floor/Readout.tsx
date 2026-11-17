'use client';
import Link from 'next/link';
import { ACT_AT, WATCH_AT, cardLabel } from '@/lib/model/core';
import { offReason, splitHoles, type Machine } from '@/lib/model/shed';
import { asOf, postAt } from '@/lib/model/replay';
import { useNaadi } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Icon, StatusIcon } from '@/components/shell/Icons';

/** The selected machine, summarised at the current card. */
export function Readout({ m, index }: { m: Machine; index: number }) {
  const { t, st } = useT();
  const c = m.cards[index];
  const s = c.off ? 'off' : c.state;
  const { steady, isolated } = splitHoles(m, c.k);
  const names = steady.length ? steady : isolated;
  const holeCount = m.cards.slice(0, index + 1).reduce((a, x) => a + x.n, 0);
  const useNote = useNaadi((st) => st.useNote);
  const at = asOf(m, index);
  const post = m.id === 'L03' ? postAt(m, index, useNote) : null;
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
      {post ? (
        at.diagnosing
          ? <p>Most likely <b>{post[0].name.toLowerCase()}</b>, {(post[0].p * 100).toFixed(1)}% · {post[0].id}{at.rul ? ` · P50 ${at.rul.p50.toFixed(1)} d` : ''}</p>
          : <p>No diagnosis yet: nothing has left this loom&apos;s normal.</p>
      ) : m.prof && at.diagnosing ? (
        <p>Most likely <b>{m.prof.label.toLowerCase()}</b>, {Math.round((m.prof.p ?? 0) * 100)}% · {m.prof.rule}</p>
      ) : m.prof ? (
        <p>Inside its normal so far; the change comes later in the fortnight.</p>
      ) : (
        <p>{holeCount ? `${holeCount} isolated hole${holeCount > 1 ? 's' : ''} so far, about what a 1% false-hole rate predicts.` : 'No holes so far this fortnight.'}</p>
      )}
      <p>Degradation index <b className="mono">{c.dS.toFixed(3)}</b> · watch at {WATCH_AT}, act at {ACT_AT}</p>
      <Link className="link" href={`/machine/${m.id}`}>{m.id === 'L03' ? t('link.case') : `Open ${m.name}'s record`}<Icon name="right" /></Link>
    </div>
  );
}
