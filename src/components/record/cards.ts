// Shared geometry for every card record: cards are laid like point paper, with a 2px gap
// between cards, an extra 2px at each midnight, and a wider gap at "now".
import { COLS, N_PAST, cardStart, ist, weekday } from '@/lib/model/core';

export const SLOT = '#E2E6DD';
export const PAINT = { normal: SLOT, watch: 'var(--watch)', act: 'var(--act)', off: 'url(#hatch)' } as const;

export function columns(x0: number, pitch: number) {
  const xs: number[] = [];
  let x = x0;
  for (let k = 0; k < COLS; k++) {
    if (k > 0 && (k - 2) % 4 === 0) x += 2;
    if (k === N_PAST) x += 10;
    xs.push(x);
    x += pitch;
  }
  return { xs, end: x };
}

export function dayTicks(pitch: number) {
  const out: { k: number; text: string; sunday: boolean }[] = [];
  for (let k = 2; k < COLS; k += 4) {
    const ms = cardStart(k);
    const p = ist(ms);
    out.push({ k, text: pitch * 4 >= 38 ? `${weekday(ms)} ${p.day}` : String(p.day), sunday: p.wd === 0 });
  }
  return out;
}

export const holeR = (n: number, cell: number) => (!n ? 0 : cell * (n === 1 ? 0.17 : n <= 3 ? 0.25 : 0.33));

/** Fractional card position for "d days after now" (for forecast brackets). */
export function daysX(xs: number[], pitch: number, days: number) {
  const k = N_PAST + days * 4;
  const kk = Math.min(COLS - 1, Math.floor(k));
  return xs[kk] + (k - kk) * pitch;
}
