'use client';
// The note for the owner. The template is always there; with a key on the server, Claude can
// phrase the same facts in the owner's language. Either way the note says which wrote it, and
// the facts it was written from are one click away.
import { useEffect, useState } from 'react';
import { getModel } from '@/lib/model';
import { ownerFacts, templateNote, type NarrateInput } from '@/lib/agents/facts';
import { Icon } from '@/components/shell/Icons';

interface Phrased { key: string; text?: string; model?: string; numbers?: number; fallback?: string; unknown?: string[] }
const WHY: Record<string, string> = {
  'no-key': 'no key on the server',
  refusal: 'it declined',
  empty: 'no text came back',
  'unchecked-number': 'its draft used a number that is not in the facts',
  auth: 'the key was rejected',
  'rate-limit': 'rate limited',
  network: 'could not reach the API',
  error: 'an error',
};

export function OwnerNote({ input }: { input: NarrateInput }) {
  const facts = ownerFacts(getModel(), input);
  const key = JSON.stringify(input);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [res, setRes] = useState<Phrased | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/narrate').then((r) => (r.ok ? r.json() : { enabled: false })).then((j: { enabled?: boolean }) => { if (live) setEnabled(!!j.enabled); }).catch(() => { if (live) setEnabled(false); });
    return () => { live = false; };
  }, []);
  const ask = async () => {
    setBusy(key);
    try {
      const r = await fetch('/api/narrate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: key });
      const j = (await r.json()) as Omit<Phrased, 'key'>;
      setRes({ key, ...j });
    } catch {
      setRes({ key, fallback: 'network' });
    } finally {
      setBusy(null);
    }
  };
  // a phrasing belongs to the facts it was written from; change a switch and the template returns
  const shown = res && res.key === key ? res : null;
  const byClaude = !!shown?.text;
  const reason = shown?.fallback ? (WHY[shown.fallback] ?? shown.fallback) : null;
  return (
    <div className="owner-box">
      <p className="owner-note" lang={input.lang}>{byClaude ? shown!.text : templateNote(facts, input.lang)}</p>
      <div className="narrator-row">
        <span className={`narrator-src${byClaude ? ' is-model' : ''}`}>
          {byClaude
            ? <><Icon name="spark" />Phrased by Claude from the facts · all {shown!.numbers} numbers checked against them</>
            : reason ? <>Template · Claude was not used: {reason}</> : <>Template</>}
        </span>
        {enabled && (
          <button type="button" className="btn-quiet" disabled={busy === key} onClick={ask}>
            {busy === key ? 'Asking Claude…' : byClaude ? 'Phrase it again' : 'Phrase with Claude'}
          </button>
        )}
      </div>
      {enabled === false && <p className="fine">With ANTHROPIC_API_KEY set on the server, Claude can phrase this note in the owner&apos;s language. It receives only the facts below and may not change a number.</p>}
      <details className="facts">
        <summary>The facts the note is written from</summary>
        <dl>
          {Object.entries(facts).map(([k, v]) => (
            <div key={k}><dt>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt><dd>{Array.isArray(v) ? v.join(' · ') : v}</dd></div>
          ))}
        </dl>
      </details>
    </div>
  );
}
