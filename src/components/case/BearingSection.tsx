'use client';
// A section through the hero motor's drive-end bearing, drawn to scale. Balls orbit at the cage frequency; every
// pass over the spall becomes a tick on the pulse strip. Shown 40 times slower than life. The spall sits where the
// fault puts it: fixed in the load zone on the outer race, or on the inner race turning with the shaft; a starved
// bearing has no spall, only its dry film drawn between the balls and the races.
import { useEffect, useRef } from 'react';
import { defectFactors } from '@/lib/model/physics';
import { activeBearing, activeFault } from '@/lib/model/setup';
import { useReducedMotion } from '@/lib/hooks';

const SLOW = 40, INK = '#17191C', ACT = '#C8372A';

export type Race = 'outer' | 'inner' | 'dry' | 'healthy';
export const raceOf = (): Race => { const f = activeFault(); return f.id === 'ir' ? 'inner' : f.id === 'lub' ? 'dry' : f.bearing ? 'outer' : 'healthy'; };

/** `severity` sizes the spall: 0 is the machine's own normal (no spall), 1 is card 56. */
export function BearingSection({ rpm, severity = 1, race = raceOf() }: { rpm: number; severity?: number; race?: Race }) {
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
    const B = activeBearing(), F = defectFactors();
    const pulses: number[] = [];
    const lastPass: number[] = [];
    let last = performance.now(), simT = 0, raf = 0;
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

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const fr = rpmRef.current / 60;
      if (!reduced) simT += dt / SLOW;
      const { w, h, dpr } = dims;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (Math.min(w, h) < 40) { raf = requestAnimationFrame(draw); return; } // not laid out yet
      const cx = w / 2, cy = h / 2, k = (Math.min(w, h) / 2 - 10) / (B.od / 2 + 3);
      const R = (mm: number) => mm * k;
      const pitchR = B.D / 2, ballR = B.d / 2;
      // housing in section, hatched
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R(B.od / 2 + 3), 0, Math.PI * 2); ctx.arc(cx, cy, R(B.od / 2), 0, Math.PI * 2, true);
      ctx.clip('evenodd');
      ctx.strokeStyle = 'rgba(23,25,28,.35)';
      ctx.lineWidth = 1;
      for (let x = -w; x < w * 2; x += 5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
      ctx.restore();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = INK;
      const ring = (r: number) => { ctx.beginPath(); ctx.arc(cx, cy, R(r), 0, Math.PI * 2); ctx.stroke(); };
      ring(B.od / 2); ring(pitchR + ballR); ring(pitchR - ballR);
      ctx.fillStyle = '#E2E6DD';
      ctx.beginPath(); ctx.arc(cx, cy, R(B.bore / 2), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const th = 2 * Math.PI * fr * simT; // shaft key mark
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(th) * R(B.bore / 2), cy + Math.sin(th) * R(B.bore / 2)); ctx.stroke();
      // the outer-race spall sits in the load zone at the bottom; an inner-race spall turns with the shaft
      const sp = race === 'inner' ? th + Math.PI / 2 : Math.PI / 2;
      const sev = sevRef.current, spall = sev >= 0.08 && (race === 'outer' || race === 'inner'), half = 0.02 + 0.05 * Math.min(1, sev);
      if (spall) {
        ctx.fillStyle = ACT;
        ctx.beginPath();
        if (race === 'outer') { ctx.arc(cx, cy, R(pitchR + ballR + 0.9 * sev), sp - half, sp + half); ctx.arc(cx, cy, R(pitchR + ballR - 0.2), sp + half, sp - half, true); }
        else { ctx.arc(cx, cy, R(pitchR - ballR + 0.2), sp - half * 1.4, sp + half * 1.4); ctx.arc(cx, cy, R(pitchR - ballR - 0.9 * sev), sp + half * 1.4, sp - half * 1.4, true); }
        ctx.closePath(); ctx.fill();
      }
      if (race === 'dry' && sev >= 0.08) {
        // no grease film: the contact bands on both races drawn dashed and dark, rubbing
        ctx.save(); ctx.strokeStyle = '#D99A00'; ctx.lineWidth = 2 + 2 * Math.min(1, sev); ctx.setLineDash([3, 4]);
        ring(pitchR + ballR + 0.4); ring(pitchR - ballR - 0.4); ctx.restore();
      }
      const cage = 2 * Math.PI * F.FTF * fr * simT;
      ctx.setLineDash([2, 3]); ring(pitchR); ctx.setLineDash([]);
      for (let i = 0; i < B.n; i++) {
        const a = cage + (2 * Math.PI * i) / B.n;
        const bx = cx + Math.cos(a) * R(pitchR), by = cy + Math.sin(a) * R(pitchR);
        ctx.fillStyle = '#F9FAF6';
        ctx.beginPath(); ctx.arc(bx, by, R(ballR), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const spin = -2 * Math.PI * F.BSF * fr * simT + a;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(spin) * R(ballR), by + Math.sin(spin) * R(ballR)); ctx.stroke();
        const rel = ((((a - sp) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        // a pass is a sign change near the spall; an inner-race spall overtakes the balls, so either direction counts
        if (spall && lastPass[i] !== undefined && Math.sign(lastPass[i]) !== Math.sign(rel) && Math.abs(rel - lastPass[i]) < 1 && !reduced) pulses.push(simT);
        lastPass[i] = rel;
      }
      // the pulse strip: the last 3 s of screen time
      const s = sdims, span = 3 / SLOW;
      sctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      sctx.clearRect(0, 0, s.w, s.h);
      sctx.fillStyle = 'rgba(64,108,98,.26)';
      sctx.fillRect(0, s.h - 1, s.w, 1);
      sctx.fillStyle = INK;
      if (reduced && sevRef.current >= 0.08) {
        if (race === 'outer' || race === 'inner') for (let tt = 0; tt < span; tt += 1 / ((race === 'outer' ? F.BPFO : F.BPFI) * fr)) sctx.fillRect((tt / span) * s.w, 4, 1.5, s.h - 8);
      } else if (!reduced) {
        while (pulses.length && pulses[0] < simT - span) pulses.shift();
        for (const p of pulses) sctx.fillRect(s.w - ((simT - p) / span) * s.w, 4, 1.5, s.h - 8);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [reduced, race]);

  return (
    <>
      <canvas ref={canvas} className="bearing-canvas" aria-label={race === 'outer' ? 'Animated section of the bearing: the balls orbit and cross a spall at the bottom of the outer race' : race === 'inner' ? 'Animated section of the bearing: a spall on the inner race turns with the shaft and the balls cross it' : race === 'dry' ? 'Animated section of the bearing: the balls orbit with no grease film, rubbing on both races' : 'Animated section of a healthy bearing: the balls orbit and cross nothing'} />
      <canvas ref={strip} className="pulse-canvas" aria-hidden="true" />
    </>
  );
}
