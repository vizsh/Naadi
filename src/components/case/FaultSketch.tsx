'use client';
// What the fault does to the machine, for the faults that are not in the bearing: unbalance
// (a heavy spot pulling the rotor round once a turn), misalignment (two shafts meeting at an
// angle, the coupling opening and closing twice a turn) and looseness (a motor foot lifting off
// its bolt and knocking back). Drawn in section like the bearing, 40 times slower than life,
// with the shaft-rate signal it makes on the strip below. Ink only; the fault in vermilion.
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import type { Family } from '@/lib/model/setup';

const SLOW = 40, INK = '#17191C', ACT = '#C8372A', PAPER = '#F9FAF6', FILL = '#E2E6DD';
export type SketchFamily = Extract<Family, 'shaft1' | 'shaft2' | 'harmonics'>;

export function FaultSketch({ family, rpm, severity = 1 }: { family: SketchFamily; rpm: number; severity?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strip = useRef<HTMLCanvasElement>(null);
  const rpmRef = useRef(rpm);
  const sevRef = useRef(severity);
  const reduced = useReducedMotion();
  useEffect(() => { rpmRef.current = rpm; }, [rpm]);
  useEffect(() => { sevRef.current = severity; }, [severity]);

  useEffect(() => {
    const cv = canvas.current!, sv = strip.current!;
    const ctx = cv.getContext('2d')!, sctx = sv.getContext('2d')!;
    const size = (c: HTMLCanvasElement) => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      return { w: r.width, h: r.height, dpr };
    };
    let dims = size(cv), sdims = size(sv);
    const ro = new ResizeObserver(() => { dims = size(cv); sdims = size(sv); });
    ro.observe(cv);
    ro.observe(sv);
    let last = performance.now(), simT = 0.004, raf = 0;

    const line = (pts: [number, number][], close = false) => {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (close) ctx.closePath();
    };
    /** the signal the fault makes, at shaft angle th (one turn = 2π), for the strip */
    const signal = (th: number, sev: number) => {
      if (family === 'shaft1') return sev * Math.sin(th);
      if (family === 'shaft2') return sev * (0.8 * Math.sin(2 * th) + 0.35 * Math.sin(th));
      const ph = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const knock = (at: number, a: number) => { const d = ph - at; return d >= 0 && d < 0.5 ? a * Math.exp(-d * 9) * Math.cos(d * 40) : 0; };
      return sev * (knock(0.1, 1) + knock(Math.PI + 0.1, 0.45));
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduced) simT += dt / SLOW;
      const fr = rpmRef.current / 60, sev = Math.min(1, Math.max(0, sevRef.current));
      const th = 2 * Math.PI * fr * simT;
      const { w, h, dpr } = dims;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.fillStyle = FILL;
      const cx = w / 2, cy = h / 2, u = Math.min(w, h) / 2 - 12;
      // not laid out yet: wait for a size rather than draw with negative radii
      if (u < 20) { raf = requestAnimationFrame(draw); return; }

      if (family === 'shaft1') {
        // end view of the rotor: its centre whirls round a small orbit, pulled by the heavy spot
        const whirl = 0.06 * u * sev;
        const ox = cx + Math.cos(th) * whirl, oy = cy + Math.sin(th) * whirl;
        ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, whirl), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(ox, oy, 0.78 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = th + (i * Math.PI) / 3; line([[ox + Math.cos(a) * 0.14 * u, oy + Math.sin(a) * 0.14 * u], [ox + Math.cos(a) * 0.7 * u, oy + Math.sin(a) * 0.7 * u]]); ctx.stroke(); }
        ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(ox, oy, 0.12 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (sev > 0.05) {
          const hx = ox + Math.cos(th) * 0.58 * u, hy = oy + Math.sin(th) * 0.58 * u;
          ctx.fillStyle = ACT; ctx.beginPath(); ctx.arc(hx, hy, 0.05 * u + 0.05 * u * sev, 0, Math.PI * 2); ctx.fill();
          // the pull: an arrow outward from the heavy spot
          const ax = ox + Math.cos(th) * (0.86 + 0.12 * sev) * u, ay = oy + Math.sin(th) * (0.86 + 0.12 * sev) * u;
          ctx.strokeStyle = ACT; line([[hx, hy], [ax, ay]]); ctx.stroke();
          const n = 0.05 * u; line([[ax, ay], [ax - Math.cos(th - 0.5) * n, ay - Math.sin(th - 0.5) * n]]); ctx.stroke(); line([[ax, ay], [ax - Math.cos(th + 0.5) * n, ay - Math.sin(th + 0.5) * n]]); ctx.stroke();
          ctx.strokeStyle = INK;
        }
      } else if (family === 'shaft2') {
        // side view: motor shaft from the left, driven shaft to the right at an angle; the
        // coupling's gap opens at the top and closes at the bottom, then the other way, twice a turn
        const ang = 0.12 * sev, flex = Math.sin(2 * th);
        const L = 0.9 * u, r = 0.11 * u;
        ctx.fillRect(cx - 1.05 * u, cy - 0.42 * u, 0.42 * u, 0.84 * u); ctx.strokeRect(cx - 1.05 * u, cy - 0.42 * u, 0.42 * u, 0.84 * u);
        line([[cx - 0.63 * u, cy - r * 0.5], [cx - 0.08 * u, cy - r * 0.5], [cx - 0.08 * u, cy + r * 0.5], [cx - 0.63 * u, cy + r * 0.5]], true); ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
        const gapTop = 0.02 * u + 0.05 * u * sev * (0.5 + 0.5 * flex), gapBot = 0.02 * u + 0.05 * u * sev * (0.5 - 0.5 * flex);
        ctx.fillStyle = FILL;
        line([[gapTop * 0.5, -1.8 * r], [0.22 * u, -1.8 * r], [0.22 * u, 1.8 * r], [gapBot * 0.5, 1.8 * r]], true); ctx.fill(); ctx.stroke();
        line([[0.22 * u, -r * 0.5], [L, -r * 0.5], [L, r * 0.5], [0.22 * u, r * 0.5]], true); ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = FILL; line([[-0.06 * u + cx, cy - 1.8 * r], [cx - 0.02 * u, cy - 1.8 * r], [cx - 0.02 * u, cy + 1.8 * r], [cx - 0.06 * u, cy + 1.8 * r]], true); ctx.fill(); ctx.stroke();
        if (sev > 0.05) {
          // where the driven shaft should run: on the motor's centreline
          ctx.strokeStyle = ACT;
          ctx.setLineDash([3, 3]); line([[cx, cy], [cx + 1.0 * u, cy]]); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = INK;
        }
      } else {
        // end view of the motor on its base: one foot lifts off its bolt and knocks back each turn
        const lift = sev * 0.06 * u * Math.max(0, Math.sin(th)) ** 3;
        const base = cy + 0.62 * u;
        ctx.fillStyle = FILL; ctx.fillRect(cx - 0.95 * u, base, 1.9 * u, 0.16 * u); ctx.strokeRect(cx - 0.95 * u, base, 1.9 * u, 0.16 * u);
        ctx.save(); ctx.translate(cx + 0.55 * u, base); ctx.rotate(-Math.atan2(lift, 1.1 * u)); ctx.translate(-(cx + 0.55 * u), -base);
        ctx.fillStyle = FILL; ctx.beginPath(); ctx.arc(cx, cy, 0.5 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 0.08 * u, 0, Math.PI * 2); ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
        line([[cx, cy], [cx + Math.cos(th) * 0.08 * u, cy + Math.sin(th) * 0.08 * u]]); ctx.stroke();
        for (const s of [-1, 1]) { line([[cx + s * 0.32 * u, cy + 0.38 * u], [cx + s * 0.55 * u, base], [cx + s * 0.3 * u, base]], true); ctx.fillStyle = FILL; ctx.fill(); ctx.stroke(); }
        ctx.restore();
        // the bolts: the right one sound, the left one loose, its nut standing proud
        for (const s of [-1, 1]) {
          const bx = cx + s * 0.43 * u;
          line([[bx, base - 0.18 * u], [bx, base + 0.16 * u]]); ctx.stroke();
          ctx.fillStyle = s < 0 && sev > 0.05 ? ACT : INK;
          ctx.fillRect(bx - 0.05 * u, base - 0.2 * u - (s < 0 ? 0.04 * u * sev : 0), 0.1 * u, 0.04 * u);
        }
      }

      // the strip: the signal the fault makes over the last three turns, shaft rate on screen
      const s = sdims;
      sctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      sctx.clearRect(0, 0, s.w, s.h);
      sctx.fillStyle = 'rgba(64,108,98,.26)';
      sctx.fillRect(0, s.h / 2, s.w, 1);
      sctx.strokeStyle = INK; sctx.lineWidth = 1.2; sctx.beginPath();
      for (let x = 0; x <= s.w; x += 1) {
        const tt = th - (1 - x / s.w) * 3 * 2 * Math.PI;
        const y = s.h / 2 - signal(tt, Math.max(0.08, sev)) * (s.h / 2 - 4);
        if (x) sctx.lineTo(x, y); else sctx.moveTo(x, y);
      }
      sctx.stroke();
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [reduced, family]);

  const label = family === 'shaft1' ? 'The rotor end on: a heavy spot pulls its centre round a small orbit once a turn'
    : family === 'shaft2' ? 'The coupling side on: two shafts meet at an angle and the gap opens and closes twice a turn'
    : 'The motor end on: its foot lifts off a loose bolt and knocks back once a turn';
  return (
    <>
      <canvas ref={canvas} className="bearing-canvas" role="img" aria-label={label} />
      <canvas ref={strip} className="pulse-canvas" aria-hidden="true" />
    </>
  );
}
