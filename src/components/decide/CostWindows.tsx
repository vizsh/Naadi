import { inr, pct } from '@/lib/model/core';
import type { Costs } from '@/lib/model/decide';

/** Expected cost per repair window; the best feasible window is inked and ticked. */
export function CostWindows({ cost, compact = false }: { cost: Costs; compact?: boolean }) {
  const max = cost.unplanned;
  return (
    <div className="windows">
      {!compact && (
        <div className="win win-head">
          <div>Repair window</div>
          <div className="mono">Fails first</div>
          <div>Expected cost</div>
        </div>
      )}
      {cost.windows.map((w) => (
        <div key={w.id} className={`win${w.id === cost.best.id ? ' is-best' : ''}${w.feasible ? '' : ' is-out'}`}>
          <div className="win-when">
            <strong>{w.when}</strong>
            <span>{w.feasible ? w.note : w.why}</span>
          </div>
          <div className="win-risk mono" title="Chance it fails before this window">{w.t === Infinity ? '100%' : pct(w.F)}</div>
          <div className="win-bar">
            <i style={{ width: `${Math.max(1.5, (w.E / max) * 68)}%` }} />
            <b className="mono">{w.feasible ? inr(w.E) : 'not possible'}</b>
          </div>
        </div>
      ))}
    </div>
  );
}
