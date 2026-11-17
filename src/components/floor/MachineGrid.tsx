'use client';
// Every machine at the replayed card, as a grid of tiles under the shed: its state, its last
// twelve cards, its degradation and what NAADI would do. Clicking a tile selects the machine.
import { cardLabel } from '@/lib/model/core';
import { asOf } from '@/lib/model/replay';
import type { Machine } from '@/lib/model/shed';
import { useT } from '@/lib/i18n';
import { StatusIcon } from '@/components/shell/Icons';

const FILL = { normal: '#E2E6DD', watch: 'var(--watch)', act: 'var(--act)', off: '#E9ECE4' } as const;

export function MachineGrid({ machines, index, selected, onSelect }: { machines: Machine[]; index: number; selected: string; onSelect: (id: string) => void }) {
  const { st } = useT();
  return (
    <div className="region machine-grid">
      <div className="region-head">
        <div>
          <h2>Every machine, now</h2>
          <p className="sub">The last twelve cards of each machine as of {cardLabel(index)}, and what NAADI would do about it.</p>
        </div>
      </div>
      <ul className="mg-tiles">
        {machines.map((m) => {
          const at = asOf(m, index);
          const s = at.scored.state;
          const from = Math.max(0, index - 11);
          const recent = m.cards.slice(from, index + 1);
          const line = m.id === 'L03' && at.rul ? `${m.prof!.label} · P50 ${at.rul.p50.toFixed(1)} days`
            : m.prof && at.diagnosing ? `${m.prof.label} · ${m.prof.rule}`
            : m.prof ? 'Inside its normal so far'
            : `${m.cards.slice(0, index + 1).reduce((a, c) => a + c.n, 0)} isolated holes · nothing to act on`;
          return (
            <li key={m.id}>
              <button type="button" className={`mg-tile${m.id === selected ? ' is-sel' : ''}`} aria-pressed={m.id === selected} onClick={() => onSelect(m.id)}>
                <span className="mg-top"><StatusIcon state={s} /><strong>{m.name}</strong><span>{st(s)}</span><b className="mono">{at.scored.dS.toFixed(3)}</b></span>
                <svg className="mg-strip" viewBox="0 0 144 12" aria-hidden="true">
                  {recent.map((c, j) => (
                    <g key={c.k}>
                      <rect x={j * 12} y="0" width="10" height="12" fill={FILL[c.off ? 'off' : c.state]} />
                      {c.n > 0 && !c.off && <circle cx={j * 12 + 5} cy="6" r={c.n > 3 ? 3.2 : c.n > 1 ? 2.5 : 1.8} fill="#17191C" />}
                    </g>
                  ))}
                </svg>
                <span className="mg-line">{line}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
