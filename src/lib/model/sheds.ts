// The kinds of shed the demo can be set in: a powerloom shed, a flour mill and a pump house.
// Each has its own machines and floor plan, the machine NAADI follows (the hero), the motor and
// drive-end bearing on that machine, what an hour of downtime costs, who leaves the voice note,
// and how the 3D camera frames it. Everything here is synthetic and labelled so in the UI.
import type { Bearing } from './physics';
import type { MachineDef, Profile } from './shed';
import type { Fault, FaultId } from './setup';

export type ShedId = 'powerloom' | 'flourmill' | 'pumphouse';
export type CameraView = 'shed' | 'looms' | 'utilities';

export interface ShedSpec {
  id: ShedId;
  label: string;
  /** shown in the header and the dealer's message */
  place: string;
  machines: MachineDef[];
  hero: string;
  /** the hero's kind of machine, as the owner says it: "your loom", "the chakki" */
  noun: string;
  nouns: string;
  heroName: { en: string; hi: string; mr: string };
  bearing: Bearing & { price: number; nde: string };
  /** the hero motor's true speed during card 56 */
  rpm: number;
  motor: string;
  /** what an hour of the hero standing costs: lost margin and idle wages */
  marginH: number;
  wagesH: number;
  others: Record<string, Profile>;
  note: { who: string; role: string; mr: string; en: string };
  views: Record<CameraView, { label: string; at: [[number, number, number], [number, number, number]] }>;
  /** per-fault wording where this shed's drive differs from a belt-driven loom */
  faultText?: Partial<Record<FaultId, Partial<Pick<Fault, 'where' | 'part' | 'partShort' | 'action' | 'why'>>>>;
  /** one line for the setup bar */
  about: string;
}

const CAV: Profile = {
  t0: 8.0, d0: 0.05, b: 0.12,
  label: 'Cavitation onset', rule: 'PMP-CAV-01', p: 0.71,
  action: 'Check the suction strainer and foot valve this week.',
  ch: { SND: [0.8, 34, 3], AMP: [0.6, 40, 3], VEL: [0.3, 46, 3] },
};
const BELT: Profile = {
  t0: 10.0, d0: 0.05, b: 0.16,
  label: 'Belt wear or slip', rule: 'BLT-02', p: 0.64,
  action: 'Check belt tension at the next shift change.',
  ch: { '1X': [0.45, 42, 3], AMP: [0.35, 46, 3] },
};
const ROTOR: Profile = {
  t0: 9.0, d0: 0.05, b: 0.13,
  label: 'Rotor bar crack', rule: 'MTR-RB-01', p: 0.58,
  action: 'Have the motor rewinder test the rotor at the next stop.',
  ch: { AMP: [0.7, 40, 3], '1X': [0.35, 45, 3] },
};

const LOOM = 'Shuttle loom, 2 hp motor, 1440 rpm';
const CHAKKI = 'Stone flour mill, 7.5 hp motor, flat belt';
const PUMP = 'Monoblock pump set, 5 hp, 2880 rpm';

export const SHEDS: Record<ShedId, ShedSpec> = {
  powerloom: {
    id: 'powerloom', label: 'Powerloom shed', place: 'Shed 2 · Ichalkaranji',
    about: 'Six shuttle looms, a chakki and two pumps',
    machines: [
      { id: 'L01', kind: 'loom', name: 'Loom 01', tag: '01', pos: [-5.6, 0, 1.3], nameplate: LOOM },
      { id: 'L02', kind: 'loom', name: 'Loom 02', tag: '02', pos: [-1.4, 0, 1.3], nameplate: LOOM },
      { id: 'L03', kind: 'loom', name: 'Loom 03', tag: '03', pos: [2.8, 0, 1.3], nameplate: `${LOOM}, DE bearing 6205-2RS` },
      { id: 'L04', kind: 'loom', name: 'Loom 04', tag: '04', pos: [-5.6, 0, -2.6], nameplate: LOOM },
      { id: 'L05', kind: 'loom', name: 'Loom 05', tag: '05', pos: [-1.4, 0, -2.6], nameplate: 'Shuttle loom, 2 hp motor, V-belt drive' },
      { id: 'L06', kind: 'loom', name: 'Loom 06', tag: '06', pos: [2.8, 0, -2.6], nameplate: LOOM },
      { id: 'C01', kind: 'chakki', name: 'Chakki', tag: 'C1', pos: [7.9, 0, -2.5], nameplate: CHAKKI },
      { id: 'P01', kind: 'pump', name: 'Pump 1', tag: 'P1', pos: [7.3, 0, 1.7], nameplate: 'Monoblock pump set, 3 hp' },
      { id: 'P02', kind: 'pump', name: 'Pump 2', tag: 'P2', pos: [9.4, 0, 1.7], nameplate: 'Monoblock pump set, 3 hp, borewell suction' },
    ],
    hero: 'L03', noun: 'loom', nouns: 'looms',
    heroName: { en: 'Loom 03', hi: 'लूम 03', mr: 'लूम 03' },
    bearing: { name: '6205-2RS', n: 9, d: 7.94, D: 39.04, phi: 0, od: 52, bore: 25, price: 380, nde: '6204' },
    rpm: 1436, motor: '2 hp, 4-pole, 1440 rpm',
    marginH: 700, wagesH: 250,
    others: { P02: CAV, L05: BELT },
    note: { who: 'Sunita K.', role: 'weaver', mr: 'खट-खट आवाज येतोय', en: 'There is a knocking sound' },
    views: {
      shed: { label: 'Shed', at: [[-6.0, 11.2, 15.8], [2.0, 0.8, -0.4]] },
      looms: { label: 'Looms', at: [[-1.0, 5.4, 10.8], [-1.2, 1.0, -0.4]] },
      utilities: { label: 'Chakki, pumps', at: [[13.6, 6.4, 8.6], [8.2, 0.9, -0.2]] },
    },
  },
  flourmill: {
    id: 'flourmill', label: 'Flour mill', place: 'Girni 1 · Amravati',
    about: 'Six stone chakkis and a water pump',
    machines: [
      { id: 'C01', kind: 'chakki', name: 'Chakki 1', tag: 'C1', pos: [-5.4, 0, 1.4], nameplate: CHAKKI },
      { id: 'C02', kind: 'chakki', name: 'Chakki 2', tag: 'C2', pos: [-1.6, 0, 1.4], nameplate: CHAKKI },
      { id: 'C03', kind: 'chakki', name: 'Chakki 3', tag: 'C3', pos: [2.2, 0, 1.4], nameplate: `${CHAKKI}, DE bearing 6308-2RS` },
      { id: 'C04', kind: 'chakki', name: 'Chakki 4', tag: 'C4', pos: [-5.4, 0, -2.5], nameplate: CHAKKI },
      { id: 'C05', kind: 'chakki', name: 'Chakki 5', tag: 'C5', pos: [-1.6, 0, -2.5], nameplate: `${CHAKKI}, worn belt splice` },
      { id: 'C06', kind: 'chakki', name: 'Chakki 6', tag: 'C6', pos: [2.2, 0, -2.5], nameplate: CHAKKI },
      { id: 'P01', kind: 'pump', name: 'Pump 1', tag: 'P1', pos: [7.6, 0, 1.6], nameplate: 'Monoblock pump set, 3 hp, borewell suction' },
    ],
    hero: 'C03', noun: 'chakki', nouns: 'chakkis',
    heroName: { en: 'Chakki 3', hi: 'चक्की 3', mr: 'चक्की 3' },
    bearing: { name: '6308-2RS', n: 8, d: 15.08, D: 65, phi: 0, od: 90, bore: 40, price: 720, nde: '6306' },
    rpm: 1452, motor: '7.5 hp, 4-pole, 1440 rpm',
    marginH: 450, wagesH: 180,
    others: { C05: BELT, P01: CAV },
    note: { who: 'Ramesh P.', role: 'miller', mr: 'मोटरमधून ठक-ठक आवाज येतोय', en: 'There is a knocking from the motor' },
    views: {
      shed: { label: 'Mill', at: [[-6.0, 11.2, 15.8], [1.0, 0.8, -0.4]] },
      looms: { label: 'Chakkis', at: [[-1.6, 5.6, 11.0], [-1.6, 1.0, -0.5]] },
      utilities: { label: 'Pump', at: [[11.8, 4.6, 7.4], [7.6, 0.7, 1.4]] },
    },
    faultText: {
      unb: { where: 'chakki pulley and rotor', action: 'Clean and rebalance the chakki pulley in the next idle window.' },
      aln: { where: 'motor-to-chakki flat belt', part: 'alignment shims and a flat belt', partShort: 'shims, flat belt', action: 'Realign the motor and chakki pulley and fit a new belt in the next idle window.' },
    },
  },
  pumphouse: {
    id: 'pumphouse', label: 'Pump house', place: 'Lift scheme 3 · Yavatmal',
    about: 'Eight monoblock pumps on a lift-irrigation scheme',
    machines: [
      { id: 'P01', kind: 'pump', name: 'Pump 1', tag: 'P1', pos: [-5.4, 0, 1.4], nameplate: PUMP },
      { id: 'P02', kind: 'pump', name: 'Pump 2', tag: 'P2', pos: [-2.4, 0, 1.4], nameplate: PUMP },
      { id: 'P03', kind: 'pump', name: 'Pump 3', tag: 'P3', pos: [0.6, 0, 1.4], nameplate: `${PUMP}, DE bearing 6206-2RS` },
      { id: 'P04', kind: 'pump', name: 'Pump 4', tag: 'P4', pos: [3.6, 0, 1.4], nameplate: PUMP },
      { id: 'P05', kind: 'pump', name: 'Pump 5', tag: 'P5', pos: [-5.4, 0, -1.9], nameplate: PUMP },
      { id: 'P06', kind: 'pump', name: 'Pump 6', tag: 'P6', pos: [-2.4, 0, -1.9], nameplate: `${PUMP}, low sump` },
      { id: 'P07', kind: 'pump', name: 'Pump 7', tag: 'P7', pos: [0.6, 0, -1.9], nameplate: PUMP },
      { id: 'P08', kind: 'pump', name: 'Pump 8', tag: 'P8', pos: [3.6, 0, -1.9], nameplate: `${PUMP}, rewound 2024` },
    ],
    hero: 'P03', noun: 'pump', nouns: 'pumps',
    heroName: { en: 'Pump 3', hi: 'पंप 3', mr: 'पंप 3' },
    bearing: { name: '6206-2RS', n: 9, d: 9.53, D: 46, phi: 0, od: 62, bore: 30, price: 450, nde: '6205' },
    rpm: 2904, motor: '5 hp, 2-pole, 2880 rpm',
    marginH: 600, wagesH: 120,
    others: { P06: CAV, P08: ROTOR },
    note: { who: 'Vitthal D.', role: 'pump operator', mr: 'पंपातून ठक-ठक आवाज येतोय', en: 'There is a knocking from the pump' },
    views: {
      shed: { label: 'Pump house', at: [[-6.0, 10.4, 14.6], [-0.8, 0.6, -0.3]] },
      looms: { label: 'Front row', at: [[-1.0, 4.2, 8.8], [-0.9, 0.6, 1.2]] },
      utilities: { label: 'Back row', at: [[7.4, 5.2, 3.6], [-0.9, 0.6, -1.9]] },
    },
    faultText: {
      unb: { where: 'impeller and rotor', part: 'impeller balancing at the workshop', partShort: 'impeller balance', action: 'Pull the impeller and have it balanced in the next idle window.' },
      aln: { where: 'motor-to-pump coupling', part: 'alignment shims and a coupling spider', partShort: 'shims, spider', action: 'Realign the motor and pump and fit a new coupling spider in the next idle window.' },
    },
  },
};

export const SHED_IDS = Object.keys(SHEDS) as ShedId[];
/** Every machine id any shed uses: the static case-file routes. */
export const ALL_MACHINE_IDS = [...new Set(SHED_IDS.flatMap((s) => SHEDS[s].machines.map((m) => m.id)))];
