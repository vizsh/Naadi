// Shared primitives: seeded randomness, the demo clock, card time and formatting.
// Readings, people and prices in NAADI's demo are synthetic. Every derived number
// on screen is computed from them by the modules in this folder.

export const CARD_H = 6; // hours per card
export const N_PAST = 56; // 14 days punched
export const N_AHEAD = 48; // 12 days of blank forecast cards
export const COLS = N_PAST + N_AHEAD;
export const HOUR = 3600e3;
/** Demo "now": Tue 17 Nov 2026, 12:00 IST. */
export const NOW = Date.UTC(2026, 10, 17, 6, 30);
export const WATCH_AT = 0.08; // degradation index thresholds
export const ACT_AT = 0.16;
export const BASE_P = 0.006; // per-channel false-hole rate the tail threshold is tuned to

export type State = 'normal' | 'watch' | 'act' | 'off';
export type Lang = 'en' | 'hi' | 'mr';

export const cardStart = (k: number) => NOW - (N_PAST - k) * CARD_H * HOUR;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const pad = (n: number) => String(n).padStart(2, '0');
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Calendar parts in IST, independent of the viewer's time zone. */
export function ist(ms: number) {
  const d = new Date(ms + 5.5 * HOUR);
  return { mo: d.getUTCMonth(), day: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}
export const weekday = (ms: number) => WD[ist(ms).wd];
export const monthName = (ms: number) => MO[ist(ms).mo];

export function cardLabel(k: number): string {
  const a = ist(cardStart(k));
  const b = ist(cardStart(k + 1));
  return `${WD[a.wd]} ${a.day} ${MO[a.mo]}, ${pad(a.h)}:00–${b.h === 0 ? '24' : pad(b.h)}:00`;
}

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const pct = (p: number) => (p < 0.001 ? '<0.1%' : p < 0.01 ? (p * 100).toFixed(1) + '%' : Math.round(p * 100) + '%');
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
