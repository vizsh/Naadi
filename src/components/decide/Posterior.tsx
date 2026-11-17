import type { Ranked } from '@/lib/model/decide';

/** Twenty 5% cells per hypothesis: ink for the leading cause, slate for the rest. */
export function Posterior({ rows, limit = 8 }: { rows: Ranked; limit?: number }) {
  return (
    <ol className="posterior">
      {rows.slice(0, limit).map((h, i) => {
        const filled = Math.round(h.p * 20);
        return (
          <li key={h.id} className={`post${i === 0 ? ' is-top' : ''}`}>
            <span className="post-name">{h.name}</span>
            <span className="post-p mono">{h.p < 0.001 ? '<0.1%' : (h.p * 100).toFixed(1) + '%'}</span>
            <span className="post-cells" aria-hidden="true">
              {Array.from({ length: 20 }, (_, c) => <i key={c} className={c < filled ? 'on' : undefined} />)}
            </span>
            <span className="post-id mono">{h.id}</span>
          </li>
        );
      })}
    </ol>
  );
}
