// The rulebook: every fault NAADI can name, what it looks like, what it sounds like,
// which evidence moves it, what to do, and where the rule comes from.
import { gauss, mulberry32 } from './model/core';
import { defectFactors } from './model/physics';

export type Family = 'Bearing' | 'Shaft' | 'Structure' | 'Electrical' | 'Pump' | 'Belt' | 'Sensor';
export interface Rule {
  id: string; name: string; family: Family; machines: string;
  signature: string; channels: string[]; evidence: [string, number][];
  action: string; source: string;
  peaks: { f: number; db: number; label?: string }[]; floorRise?: number; sidebands?: number;
}
const fr = 23.95; // 1,437 rpm
const F = defectFactors();

export const RULES: Rule[] = [
  {
    id: 'BRG-OR-01', name: 'Bearing outer-race defect', family: 'Bearing', machines: 'any motor or shaft bearing',
    signature: 'Envelope peaks at BPFO and its harmonics, no 1× sidebands; kurtosis rises before velocity does.',
    channels: ['Envelope', 'Kurtosis', 'Sound', 'Velocity', 'Temp'],
    evidence: [['Envelope peak at BPFO, 6 dB over baseline', 8], ['Kurtosis above 4', 3], ['Worker hears knocking', 1.8], ['Housing warmer than its load-matched baseline', 1.4]],
    action: 'Replace the bearing in the next idle window; check lubrication and fit.', source: 'ISO 13373-3; rolling-bearing damage guides',
    peaks: [{ f: F.BPFO * fr, db: 17, label: 'BPFO' }, { f: 2 * F.BPFO * fr, db: 12, label: '2×' }, { f: 3 * F.BPFO * fr, db: 8, label: '3×' }, { f: 4 * F.BPFO * fr, db: 4.5 }],
  },
  {
    id: 'BRG-IR-01', name: 'Bearing inner-race defect', family: 'Bearing', machines: 'any motor or shaft bearing',
    signature: 'Envelope peaks at BPFI with sidebands at ±1× (the defect rotates in and out of the load zone).',
    channels: ['Envelope', 'Kurtosis', 'Velocity'],
    evidence: [['Envelope peak at BPFI with ±1× sidebands', 8], ['Kurtosis above 4', 3], ['No BPFO family', 1.5]],
    action: 'Replace the bearing soon; inner-race spalls grow faster than outer-race ones.', source: 'ISO 13373-3',
    peaks: [{ f: F.BPFI * fr, db: 15, label: 'BPFI' }, { f: F.BPFI * fr - fr, db: 8, label: '−1×' }, { f: F.BPFI * fr + fr, db: 8, label: '+1×' }, { f: 2 * F.BPFI * fr, db: 9, label: '2×' }],
  },
  {
    id: 'BRG-LUB-02', name: 'Lubrication starvation', family: 'Bearing', machines: 'greased bearings',
    signature: 'A broadband rise in high-frequency energy and temperature, without discrete defect tones.',
    channels: ['Sound', 'Temp', 'Kurtosis'],
    evidence: [['Housing temperature up', 2.5], ['High-frequency floor up 6 dB', 2], ['No defect tones', 1.5]],
    action: 'Re-grease to the maker’s quantity; re-check temperature after one shift.', source: 'bearing lubrication practice',
    peaks: [{ f: fr, db: 5, label: '1×' }], floorRise: 7,
  },
  {
    id: 'UNB-01', name: 'Unbalance', family: 'Shaft', machines: 'fans, pulleys, rotors',
    signature: 'A strong 1× radial peak, steady in phase, rising with the square of speed.',
    channels: ['1× shaft', 'Velocity'],
    evidence: [['1× more than doubled since baseline', 6], ['2× and harmonics small', 2], ['Radial more than axial', 1.5]],
    action: 'Clean and balance the rotor; check for lost balance weights or build-up.', source: 'ISO 20816; ISO 21940 balancing',
    peaks: [{ f: fr, db: 20, label: '1×' }, { f: 2 * fr, db: 4, label: '2×' }],
  },
  {
    id: 'ALN-02', name: 'Belt or shaft misalignment', family: 'Shaft', machines: 'belt and coupling drives',
    signature: 'A high 2× (often above 1×), strong axial vibration, and heat at the coupling or belt.',
    channels: ['2× shaft', '1× shaft', 'Current'],
    evidence: [['2× above half of 1×', 5], ['Axial vibration high', 3], ['Belt edge wear seen', 2]],
    action: 'Realign pulleys or the coupling with a straight edge or laser; re-tension belts.', source: 'ISO 13373-3',
    peaks: [{ f: fr, db: 12, label: '1×' }, { f: 2 * fr, db: 16, label: '2×' }, { f: 3 * fr, db: 6, label: '3×' }],
  },
  {
    id: 'LSN-01', name: 'Mechanical looseness', family: 'Structure', machines: 'bolted bases, worn fits',
    signature: 'Many harmonics of 1× (up to 10×) and half-order peaks; a raised, ragged floor.',
    channels: ['1× shaft', '2× shaft', 'Velocity', 'Kurtosis'],
    evidence: [['Harmonics beyond 4×', 5], ['Half-order peaks', 4], ['Rattle reported', 1.6]],
    action: 'Torque the base bolts; check for cracked feet, soft foot and worn bearing fits.', source: 'ISO 13373-3',
    peaks: [0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8].map((h, i) => ({ f: h * fr, db: h % 1 ? 6 : 13 - i * 0.9, label: h === 0.5 ? '½×' : h === 1 ? '1×' : undefined })),
  },
  {
    id: 'MTR-RB-01', name: 'Broken rotor bar', family: 'Electrical', machines: 'induction motors',
    signature: 'In the motor current, sidebands at line frequency ± 2 × slip × line frequency; a slow beat in the hum.',
    channels: ['Current', 'Sound'],
    evidence: [['Current sidebands within 45 dB of the line peak', 6], ['Hum beats at 2 × slip frequency', 2]],
    action: 'Plan a motor rewind or replacement; avoid frequent direct-on-line starts meanwhile.', source: 'motor current signature analysis (MCSA) practice',
    peaks: [{ f: 50, db: 24, label: 'line' }, { f: 46, db: 9, label: '−2sf' }, { f: 54, db: 9, label: '+2sf' }, { f: 100, db: 8 }],
  },
  {
    id: 'PMP-CAV-01', name: 'Cavitation', family: 'Pump', machines: 'centrifugal pumps, borewell suction',
    signature: 'Broadband crackle above 2 kHz and a fluttering motor current; worse at low suction head.',
    channels: ['Sound', 'Current', 'Velocity'],
    evidence: [['Broadband sound above 2 kHz up', 5], ['Current fluttering', 3], ['Low water level reported', 2]],
    action: 'Clean the suction strainer and foot valve; check the water level and suction leaks.', source: 'pump cavitation practice',
    peaks: [{ f: fr, db: 5, label: '1×' }], floorRise: 10,
  },
  {
    id: 'BLT-02', name: 'Belt wear or slip', family: 'Belt', machines: 'V-belt and flat-belt drives',
    signature: 'Sub-synchronous peaks at the belt frequency, a 1× that wanders, and current that sags under load.',
    channels: ['1× shaft', 'Current'],
    evidence: [['Belt-frequency peak', 4], ['1× wanders', 2], ['Squeal at start', 1.8]],
    action: 'Re-tension or replace the belt set; check pulley groove wear.', source: 'belt drive practice',
    peaks: [{ f: 8.2, db: 11, label: 'belt' }, { f: 16.4, db: 7, label: '2× belt' }, { f: fr, db: 9, label: '1×' }],
  },
  {
    id: 'SNS-00', name: 'Sensor or mounting fault', family: 'Sensor', machines: 'every sensor',
    signature: 'A sudden step, dropouts or a flat line across every band at once, with no physical cause.',
    channels: ['all'],
    evidence: [['All channels jump together', 6], ['Readings clip or drop out', 4]],
    action: 'Re-seat the sensor (magnet or stud), check the cable; ignore the cards until fixed.', source: 'instrumentation practice',
    peaks: [], floorRise: -8,
  },
];

/** A synthetic 0–400 Hz vibration (or current) spectrum for a rule's signature, in dB. */
export function ruleSpectrum(r: Rule, seed = 1) {
  const rng = mulberry32(seed + r.id.length * 31);
  const df = 0.5, n = 801;
  const f: number[] = [], db: number[] = [];
  for (let i = 0; i < n; i++) {
    const fi = i * df;
    const floor = -64 + 7 * Math.exp(-fi / 35) + (r.floorRise ?? 0) * (fi > 150 ? 1 : fi / 150) + 0.6 * gauss(rng);
    let p = Math.pow(10, floor / 10);
    for (const pk of r.peaks) p += Math.pow(10, (-62 + pk.db) / 10) * Math.exp(-0.5 * ((fi - pk.f) / 0.7) ** 2);
    f.push(fi);
    db.push(10 * Math.log10(p));
  }
  return { f, db };
}

/** What a rule sounds like: 2.4 s at 22.05 kHz, physically suggestive rather than exact. */
export function ruleSound(r: Rule): { data: Float32Array; rate: number } {
  const rate = 22050, n = Math.floor(2.4 * rate);
  const x = new Float32Array(n);
  const rng = mulberry32(r.id.length * 97);
  let pink = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    pink = 0.96 * pink + 0.04 * gauss(rng);
    let v = 0.2 * Math.sin(2 * Math.PI * 100 * t) + 0.05 * Math.sin(2 * Math.PI * fr * t) + 0.12 * pink;
    switch (r.id) {
      case 'UNB-01': v += 0.35 * Math.sin(2 * Math.PI * fr * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 100 * t)); break;
      case 'ALN-02': v += 0.25 * Math.sin(2 * Math.PI * 2 * fr * t) + 0.1 * Math.sin(2 * Math.PI * 3 * fr * t); break;
      case 'LSN-01': for (let h = 1; h <= 8; h++) v += (0.06 / h) * Math.sign(Math.sin(2 * Math.PI * h * fr * t)); break;
      case 'MTR-RB-01': v *= 1 + 0.6 * Math.sin(2 * Math.PI * 4 * t); break;
      case 'BRG-LUB-02': v += 0.2 * gauss(rng) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.7 * t)); break;
      case 'PMP-CAV-01': if (rng() < 0.012) v += (rng() - 0.5) * 1.6; v += 0.15 * gauss(rng); break;
      case 'BLT-02': v *= 1 + 0.45 * Math.sin(2 * Math.PI * 8.2 * t); if (t < 0.5) v += 0.12 * Math.sin(2 * Math.PI * 2400 * t); break;
      case 'SNS-00': if (Math.floor(t * 3) % 3 === 1) v = 0; break;
    }
    x[i] = v;
  }
  if (r.id === 'BRG-OR-01' || r.id === 'BRG-IR-01') {
    const rateHz = r.id === 'BRG-OR-01' ? F.BPFO * fr : F.BPFI * fr;
    for (let t = 0.01; t < 2.39; t += 1 / rateHz) {
      const i0 = Math.floor(t * rate);
      const a = r.id === 'BRG-IR-01' ? 0.35 + 0.3 * Math.sin(2 * Math.PI * fr * t) : 0.55;
      for (let j = 0; j < 90 && i0 + j < n; j++) x[i0 + j] += a * Math.exp(-j / rate / 0.0006) * Math.sin(2 * Math.PI * 3200 * (j / rate));
    }
  }
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < n; i++) x[i] *= (0.7 / peak) * Math.min(1, i / 600, (n - 1 - i) / 600);
  return { data: x, rate };
}
