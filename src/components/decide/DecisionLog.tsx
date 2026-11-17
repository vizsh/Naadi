'use client';
// The owner's decisions on this device: every approve, not now and undo, with the window and
// the expected cost at that moment. Kept in localStorage, so it survives reloads and no signal.
import { useNaadi } from '@/lib/store';

const WORD = { approved: 'Approved', snoozed: 'Not now', open: 'Undone' } as const;

export function DecisionLog() {
  const log = useNaadi((s) => s.log);
  const clear = useNaadi((s) => s.clearLog);
  if (!log.length) return <p className="fine">No decisions yet. Approvals and undos are kept on this device, so they survive a reload or a lost signal.</p>;
  return (
    <>
      <ol className="dlog">
        {[...log].reverse().slice(0, 6).map((e) => {
          const d = new Date(e.at);
          return (
            <li key={e.at}>
              <span className="mono">{d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              <b>{WORD[e.decision]}</b>
              <span>{e.window.split(',')[0]} · {e.expected}{!e.scenario.powerCut ? ' · power cut off' : ''}{!e.scenario.partInStock ? ' · part out of stock' : ''}</span>
            </li>
          );
        })}
      </ol>
      <p className="fine">Kept on this device only. <button type="button" className="btn-quiet" onClick={clear}>Clear the log</button></p>
    </>
  );
}
