'use client';
// One tooltip for the whole app. Values lead, labels follow; text only (never HTML).
import { useLayoutEffect, useRef, useState } from 'react';
import { useTip } from '@/lib/store';

export function TipLayer() {
  const tip = useTip((s) => s.tip);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<[number, number]>([0, 0]);
  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    let x = tip.x + 14, y = tip.y + 16;
    if (x + r.width > window.innerWidth - 8) x = tip.x - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = tip.y - r.height - 12;
    setPos([Math.round(x), Math.round(y)]);
  }, [tip]);
  if (!tip) return null;
  return (
    <div ref={ref} className="tip" role="tooltip" style={{ transform: `translate(${pos[0]}px, ${pos[1]}px)` }}>
      <strong>{tip.lead}</strong>
      {tip.lines.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}
