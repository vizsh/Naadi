'use client';
// The Live Lab's machine on the floor. It gets its own row under the card record because its
// cards are two seconds long, not six hours: the same idea at a different clock. Newest right.
import Link from 'next/link';
import { useRef } from 'react';
import { CHANNELS, type LabCard } from '@/lib/lab/engine';
import { useLab } from '@/lib/lab/live';
import { useWidth } from '@/lib/hooks';
import { hideTip, tipAt } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Icon, StatusIcon } from '@/components/shell/Icons';
import { PAINT, holeR } from '@/components/record/cards';

const NONE: LabCard[] = [];
const N = 60;

export function LiveBand({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const cards = useLab((s) => s.cards, NONE);
  const source = useLab((s) => s.source, null);
  const { st } = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap) || 900;
  const pitch = Math.max(9, Math.min(13, Math.floor((W - 8) / N)));
  const cell = pitch - 2, H = cell + 22;
  const shown = cards.slice(-N);
  const last = cards[cards.length - 1];
  const tip = (e: React.PointerEvent) => {
    const t = (e.target as Element).closest('[data-j]') as SVGElement | null;
    if (!t) return hideTip();
    const c = shown[Number(t.dataset.j)];
    if (!c) return tipAt(e, 'Not yet punched', ['One card every two seconds']);
    const names = CHANNELS.filter((_, i) => c.holes[i]);
    tipAt(e, st(c.state), [`Live card ${c.id}`, names.length ? `Holes: ${names.join(', ')}` : 'No holes: every channel inside the normal you taught it', `Mean distance ${c.dMean.toFixed(1)}`]);
  };
  return (
    <div className={`live-band${selected ? ' is-sel' : ''}`}>
      <button type="button" className="live-band-label" aria-pressed={selected} onClick={onSelect}>
        <StatusIcon state={last?.state ?? 'normal'} size={14} />
        <span><strong>Live machine</strong><span>{source === 'mic' ? 'your microphone' : 'synthesised fan'} · 1 card = 2 s</span></span>
      </button>
      <div className="scroll-x" ref={wrap}>
        <svg width={Math.max(W, N * pitch + 8)} height={H} role="img" aria-label="Live machine card chain, one card every two seconds" onPointerMove={tip} onPointerLeave={hideTip}>
          {Array.from({ length: N }, (_, j) => {
            const c = shown[j - (N - shown.length)];
            const x = 4 + j * pitch;
            if (!c) return <rect key={'b' + j} x={x + 0.5} y={4.5} width={cell - 1} height={cell - 1} className="c-blank" data-j={j - (N - shown.length)} />;
            const n = c.holes.filter(Boolean).length;
            const r = holeR(n, cell);
            return (
              <g key={'c' + c.id}>
                <rect x={x} y={4} width={cell} height={cell} fill={PAINT[c.state]} data-j={j - (N - shown.length)} />
                {r > 0 && <circle cx={x + cell / 2} cy={4 + cell / 2} r={r} fill="var(--ink)" pointerEvents="none" />}
              </g>
            );
          })}
          <text x={4} y={H - 2} className="t-cap">{cards.length ? `${cards.length} cards since you taught it normal` : 'Waiting for the first card'}</text>
          <text x={4 + N * pitch - 2} y={H - 2} className="t-cap" textAnchor="end">now</text>
        </svg>
      </div>
    </div>
  );
}

/** The readout when the live machine is selected on the floor. */
export function LiveReadout() {
  const { st } = useT();
  const cards = useLab((s) => s.cards, NONE);
  const source = useLab((s) => s.source, null);
  const d2 = useLab((s) => Math.round(s.d2 * 10) / 10, 0);
  const thr = useLab((s) => s.threshold, 0);
  const last = cards[cards.length - 1];
  const state = last?.state ?? 'normal';
  const holes = last ? CHANNELS.filter((_, i) => last.holes[i]) : [];
  return (
    <div className="readout">
      <div className="ro-head" aria-live="polite">
        <StatusIcon state={state} />
        Live machine
        <span>· {st(state)}</span>
      </div>
      <p>Your {source === 'mic' ? 'microphone' : 'synthesised fan'} · {cards.length} cards · one every 2 s</p>
      <p>{!last ? 'Waiting for the first card.' : holes.length ? <>Holes in <b>{holes.join(', ')}</b></> : 'No holes: every channel inside the normal you taught it'}</p>
      <p>Distance <b className="mono">{d2.toFixed(1)}</b> against its own threshold of {thr.toFixed(1)}</p>
      <Link className="link" href="/lab">Open the Live Lab<Icon name="right" /></Link>
    </div>
  );
}
