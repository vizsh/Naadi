'use client';
// The Live Lab's saved sessions: each learned normal and the cards it punched, kept in this
// browser's IndexedDB. Resume scores against the saved normal without learning again.
import { useEffect, useState } from 'react';
import { getLabEngine } from '@/lib/lab/engine';
import { currentSessionId, listSessions, onSessionsChanged, removeSession, resumeSession, type SessionSummary } from '@/lib/lab/sessions';
import { useMounted } from '@/lib/hooks';
import { Icon } from '@/components/shell/Icons';

const FILL = { normal: '#E2E6DD', watch: 'var(--watch)', act: 'var(--act)' } as const;
const when = (ms: number) => { const d = new Date(ms); return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`; };

export function SavedSessions({ watching }: { watching: boolean }) {
  const mounted = useMounted();
  const [rows, setRows] = useState<SessionSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!mounted || typeof indexedDB === 'undefined') return;
    let live = true;
    const load = () => { listSessions().then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows([]); }); };
    load();
    const off = onSessionsChanged(load);
    return () => { live = false; off(); };
  }, [mounted]);
  const current = watching ? currentSessionId() : null;

  return (
    <div className="region lab-saved">
      <div className="region-head">
        <div>
          <h2>Saved on this device</h2>
          <p className="sub">Every learned normal is kept with the cards it punched, in this browser only. Resume one to score the same machine again without learning: hold the phone in the same place.</p>
        </div>
      </div>
      {rows === null ? <p className="sub">Reading saved sessions…</p>
        : rows.length === 0 ? <p className="sub">Nothing saved yet. Learn a machine&apos;s normal and its session is saved here, card by card.</p>
        : (
          <ul className="sessions">
            {rows.map((r) => (
              <li key={r.id} className={r.id === current ? 'is-on' : ''}>
                <div className="sess-top">
                  <strong>{when(r.started)}</strong>
                  <span>{r.source === 'mic' ? 'microphone' : 'synthesised fan'} · {r.count} cards{r.watch ? ` · ${r.watch} watch` : ''}{r.act ? ` · ${r.act} act` : ''}</span>
                  {r.id === current && <em>Recording</em>}
                </div>
                <svg className="sess-strip" viewBox="0 0 320 10" aria-label={`Last ${r.recent.length} cards`}>
                  {r.recent.map((c, j) => (
                    <g key={c.id + '-' + j}>
                      <rect x={j * 8} y="0" width="6.5" height="10" fill={FILL[c.state]} />
                      {c.holes.some(Boolean) && <circle cx={j * 8 + 3.25} cy="5" r="1.7" fill="#17191C" />}
                    </g>
                  ))}
                </svg>
                <div className="sess-actions">
                  {r.id !== current && (
                    <button type="button" className="btn" disabled={!!busy} onClick={async () => { setBusy(r.id); await resumeSession(getLabEngine(), r.id).finally(() => setBusy(null)); }}>
                      <Icon name="play" />{busy === r.id ? 'Starting…' : 'Resume'}
                    </button>
                  )}
                  <button type="button" className="btn-quiet" disabled={!!busy} onClick={() => void removeSession(r.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
