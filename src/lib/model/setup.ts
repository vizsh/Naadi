// The demo's setup: which kind of shed, what fault its hero machine develops, how fast it wears, how the power behaves, how
// noisy the floor is, and which random fortnight is drawn. Every page is built from the active
// setup, so no two demos need look alike. The default reproduces the original demo exactly.
// All of it is synthetic; the maths that reads it is the same whatever is chosen.

export type FaultId = 'or' | 'ir' | 'unb' | 'aln' | 'lub' | 'lsn';
export type Wear = 'slow' | 'typical' | 'fast' | 'accelerating';
export type Power = 'scheduled' | 'reliable' | 'unscheduled';
export type Floor = 'quiet' | 'noisy';
export type Orders = 'slack' | 'normal' | 'rush';
export type Kit = 'kit' | 'phone';
import { SHEDS, SHED_IDS, type ShedId, type ShedSpec } from './sheds';
export type { ShedId };
export interface Setup { shed: ShedId; fault: FaultId; wear: Wear; power: Power; floor: Floor; orders: Orders; kit: Kit; seed: number }

export const DEFAULT_SETUP: Setup = { shed: 'powerloom', fault: 'or', wear: 'typical', power: 'scheduled', floor: 'quiet', orders: 'normal', kit: 'kit', seed: 20261117 };

/** The spectral signature a fault leaves in the envelope spectrum. */
export type Family = 'bpfo' | 'bpfi' | 'shaft1' | 'shaft2' | 'broadband' | 'harmonics';

export interface Fault {
  id: FaultId;
  rule: string;
  label: string;
  /** the part, as the dealer would name it */
  part: string;
  partShort: string;
  price: number;
  labour: number;
  action: string;
  family: Family;
  /** where on the machine the fault lives */
  where: string;
  /** one sentence on why its frequencies look the way they do */
  why: string;
  /** a bearing fault, with a spall the 3D motor can show */
  bearing: boolean;
  /** channel → [amplitude, centre card, width] of the logistic that raises its hole probability */
  ch: Record<string, [number, number, number]>;
}

// Channel orders follow how each fault shows itself: a bearing spall reaches the envelope first,
// unbalance lifts 1× and velocity, misalignment lifts 2× and runs warm, starved grease heats up
// and hisses in the high band, looseness rattles out shaft harmonics and impacts.
export const FAULTS: Record<FaultId, Fault> = {
  or: {
    id: 'or', rule: 'BRG-OR-01', label: 'Bearing outer-race defect', part: '{B} bearing', partShort: '{B}', price: 380, labour: 900,
    action: 'Replace the drive-end bearing ({B}) in the next idle window.', family: 'bpfo', bearing: true,
    where: 'motor drive-end bearing {B}', why: '{Balls} balls cross a spall on the outer race {bpfo} times a shaft turn, so the envelope rings at BPFO and its harmonics.',
    ch: { ENV: [0.95, 24, 3], KURT: [0.9, 30, 3], VEL: [0.9, 40, 3], SND: [0.85, 36, 3], TMP: [0.8, 47, 2.5], AMP: [0.2, 48, 3] },
  },
  ir: {
    id: 'ir', rule: 'BRG-IR-01', label: 'Bearing inner-race defect', part: '{B} bearing', partShort: '{B}', price: 380, labour: 900,
    action: 'Replace the drive-end bearing ({B}) and check the shaft fit in the next idle window.', family: 'bpfi', bearing: true,
    where: 'motor drive-end bearing {B}', why: 'A spall on the inner race turns with the shaft, so the balls strike it at BPFI, {bpfi} times a turn, and the load zone modulates it into sidebands one shaft speed either side.',
    ch: { ENV: [0.9, 26, 3], KURT: [0.9, 28, 3], VEL: [0.85, 38, 3], SND: [0.8, 35, 3], TMP: [0.7, 48, 2.5] },
  },
  unb: {
    id: 'unb', rule: 'UNB-01', label: 'Unbalance', part: 'balancing weights for the pulley', partShort: 'balance weights', price: 150, labour: 700,
    action: 'Clean and rebalance the drive pulley in the next idle window.', family: 'shaft1', bearing: false,
    where: 'drive pulley and rotor', why: 'A heavy spot pulls the shaft round once a turn, so the energy sits at 1× shaft speed with little at the bearing tones.',
    ch: { '1X': [0.95, 26, 3], VEL: [0.9, 32, 3], SND: [0.45, 42, 3], AMP: [0.3, 46, 3] },
  },
  aln: {
    id: 'aln', rule: 'ALN-02', label: 'Belt or shaft misalignment', part: 'alignment shims and a V-belt', partShort: 'shims, V-belt', price: 420, labour: 800,
    action: 'Realign the motor and pulley and fit a new belt in the next idle window.', family: 'shaft2', bearing: false,
    where: 'motor-to-loom belt drive', why: 'Shafts that meet at an angle flex twice a turn, so 2× shaft speed rises beside 1× and the coupling runs warm.',
    ch: { '2X': [0.9, 26, 3], '1X': [0.6, 32, 3], VEL: [0.8, 36, 3], TMP: [0.55, 45, 3] },
  },
  lub: {
    id: 'lub', rule: 'BRG-LUB-02', label: 'Lubrication starvation', part: 'bearing grease, flush and refill', partShort: 'grease', price: 120, labour: 400,
    action: 'Flush and regrease the drive-end bearing in the next idle window.', family: 'broadband', bearing: true,
    where: 'motor drive-end bearing {B}', why: 'Without a grease film the balls rub instead of rolling, so the whole high band hisses and heats, with no single tone standing out.',
    ch: { TMP: [0.9, 27, 3], SND: [0.85, 31, 3], KURT: [0.55, 38, 3], ENV: [0.4, 44, 3] },
  },
  lsn: {
    id: 'lsn', rule: 'LSN-01', label: 'Mechanical looseness', part: 'foundation bolts and a mount pad', partShort: 'bolts, mount pad', price: 260, labour: 600,
    action: 'Tighten and re-seat the motor mount in the next idle window.', family: 'harmonics', bearing: false,
    where: 'motor mount and base', why: 'A loose mount lets the motor rattle against its bolts, so the shaft speed comes out as a ladder of harmonics and half-orders.',
    ch: { '1X': [0.75, 27, 3], '2X': [0.75, 29, 3], KURT: [0.65, 34, 3], VEL: [0.85, 38, 3], SND: [0.5, 44, 3] },
  },
};

export const WEAR: Record<Wear, { b: number; a: number; label: string }> = {
  slow: { b: 0.15, a: 0, label: 'Slow' },
  typical: { b: 0.21, a: 0, label: 'Typical' },
  fast: { b: 0.28, a: 0, label: 'Fast' },
  accelerating: { b: 0.16, a: 0.014, label: 'Speeding up' },
};
export const FLOOR: Record<Floor, { falseHole: number; noise: number; label: string }> = {
  quiet: { falseHole: 0.006, noise: 0.08, label: 'Quiet' },
  noisy: { falseHole: 0.02, noise: 0.13, label: 'Noisy' },
};
export const POWER_LABEL: Record<Power, string> = { scheduled: 'Scheduled cuts', reliable: 'Reliable', unscheduled: 'Unscheduled cuts' };
/** The order book: how much margin an hour of the hero standing loses. Wages are paid either way. */
export const ORDERS: Record<Orders, { m: number; label: string; note: string }> = {
  slack: { m: 0.5, label: 'Slack', note: 'half the usual margin: lost output can be made up later' },
  normal: { m: 1, label: 'Normal', note: 'the usual margin' },
  rush: { m: 1.8, label: 'Rush', note: 'a delivery is due: every hour lost costs a late-delivery penalty on top' },
};
/** What is listening. The clip-on kit has all eight channels; a phone has a microphone and an
 *  accelerometer, so it cannot read motor current or housing temperature, hears the bearing through
 *  the air rather than the housing (weaker tones), and its degradation index is noisier. */
export const KIT: Record<Kit, { label: string; price: number; missing: string[]; toneGain: number; noise: number; envAmp: number; note: string }> = {
  kit: { label: 'Clip-on kit', price: 1500, missing: [], toneGain: 1, noise: 1, envAmp: 1, note: 'accelerometer on the drive-end housing, current clamp, thermistor, microphone' },
  phone: { label: 'Phone only', price: 0, missing: ['AMP', 'TMP'], toneGain: 0.5, noise: 1.5, envAmp: 0.7, note: 'the microphone and accelerometer of a phone propped against the machine' },
};

// ------------------------------------------------------------ the active setup
let active: Setup = DEFAULT_SETUP;
export const activeSetup = () => active;
export const activeShed = (): ShedSpec => SHEDS[active.shed];
export const activeBearing = () => activeShed().bearing;
export const activeKit = () => KIT[active.kit];
export const activeOrders = () => ORDERS[active.orders];
/** The machine NAADI follows in this shed, and its name in each language. */
export const heroId = () => activeShed().hero;
export const heroName = (lang: 'en' | 'hi' | 'mr' = 'en') => activeShed().heroName[lang];
export function setActiveSetup(s: Setup) { active = s; }
export const setupKey = (s: Setup) => `${s.shed}.${s.fault}.${s.wear}.${s.power}.${s.floor}.${s.orders}.${s.kit}.${s.seed}`;

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const faultCache = new Map<string, Fault>();
/** The active fault, worded for this shed: its bearing, its drive, and the bearing's own defect ratios. */
export function activeFault(): Fault {
  const key = `${active.shed}.${active.fault}`;
  const hit = faultCache.get(key);
  if (hit) return hit;
  const shed = activeShed(), b = shed.bearing, f = FAULTS[active.fault];
  const r = b.d / b.D;
  const sub = (s: string) => s.replaceAll('{B}', b.name).replaceAll('{Balls}', WORDS[b.n] ?? String(b.n))
    .replaceAll('{bpfo}', ((b.n / 2) * (1 - r)).toFixed(3)).replaceAll('{bpfi}', ((b.n / 2) * (1 + r)).toFixed(3))
    .replaceAll('motor-to-loom', `motor-to-${shed.noun}`);
  const over = shed.faultText?.[active.fault] ?? {};
  const out: Fault = {
    ...f,
    part: sub(over.part ?? f.part), partShort: sub(over.partShort ?? f.partShort), action: sub(over.action ?? f.action),
    where: sub(over.where ?? f.where), why: sub(over.why ?? f.why),
    price: f.id === 'or' || f.id === 'ir' ? b.price : f.price,
  };
  faultCache.set(key, out);
  return out;
}
export const isDefault = (s: Setup) => setupKey(s) === setupKey(DEFAULT_SETUP);

/** Read a setup from a URL query, ignoring anything that is not a known option. */
export function setupFromQuery(q: URLSearchParams, base: Setup = DEFAULT_SETUP): Setup {
  const pick = <T extends string>(k: string, ok: readonly T[], d: T) => { const v = q.get(k) as T | null; return v && ok.includes(v) ? v : d; };
  const seed = Number(q.get('seed'));
  return {
    shed: pick('shed', SHED_IDS, base.shed),
    fault: pick('fault', Object.keys(FAULTS) as FaultId[], base.fault),
    wear: pick('wear', Object.keys(WEAR) as Wear[], base.wear),
    power: pick('power', ['scheduled', 'reliable', 'unscheduled'] as const, base.power),
    floor: pick('floor', ['quiet', 'noisy'] as const, base.floor),
    orders: pick('orders', Object.keys(ORDERS) as Orders[], base.orders),
    kit: pick('kit', Object.keys(KIT) as Kit[], base.kit),
    seed: Number.isInteger(seed) && seed > 0 && seed < 2 ** 31 ? seed : base.seed,
  };
}
export function setupToQuery(s: Setup): string {
  if (isDefault(s)) return '';
  const q = new URLSearchParams();
  (['shed', 'fault', 'wear', 'power', 'floor', 'orders', 'kit'] as const).forEach((k) => { if (s[k] !== DEFAULT_SETUP[k]) q.set(k, s[k]); });
  if (s.seed !== DEFAULT_SETUP.seed) q.set('seed', String(s.seed));
  return q.toString();
}
