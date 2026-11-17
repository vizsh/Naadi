import { HYPOTHESES, type Evidence, type EvidenceId } from '@/lib/model/decide';

/** Each piece of evidence with its likelihood ratio for the leading cause and its rule citation. */
export function EvidenceList({ items, ids, compact = false }: { items: Evidence[]; ids: EvidenceId[]; compact?: boolean }) {
  const OR = HYPOTHESES[0];
  return (
    <ul className={`evidence${compact ? ' compact' : ''}`}>
      {items.filter((e) => ids.includes(e.id)).map((e) => (
        <li key={e.id}>
          <span>{e.text}</span>
          <span className="lr mono">{e.id === 'bpfi' ? '×0.2 for inner race' : e.id === 'x1' ? '×0.2 for unbalance' : `×${OR.lr[e.id].toFixed(1)}`}</span>
          <span className="rule mono">{e.rule}</span>
        </li>
      ))}
    </ul>
  );
}
