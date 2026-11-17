'use client';
// App-wide state: language, the replay index, the selected machine, the owner's decision,
// the case file's speed control and the what-if scenario the agents plan against.
import { create } from 'zustand';
import { N_PAST, type Lang } from './model/core';
import { BASE_SCENARIO, type Scenario } from './model/decide';

export type Decision = 'open' | 'approved' | 'snoozed';

interface NaadiState {
  lang: Lang;
  index: number;
  selected: string;
  decision: Decision;
  rpm: number | null;
  scenario: Scenario;
  useNote: boolean;
  /** the Live Lab's machine stands on the shed floor (its engine keeps running) */
  labOnFloor: boolean;
  setLabOnFloor: (v: boolean) => void;
  setLang: (l: Lang) => void;
  setIndex: (k: number) => void;
  select: (id: string) => void;
  decide: (d: Decision) => void;
  setRpm: (r: number) => void;
  setScenario: (s: Partial<Scenario>) => void;
  setUseNote: (v: boolean) => void;
}

export const useNaadi = create<NaadiState>((set) => ({
  lang: 'en',
  index: N_PAST - 1,
  selected: 'L03',
  decision: 'open',
  rpm: null,
  scenario: BASE_SCENARIO,
  useNote: true,
  labOnFloor: false,
  setLabOnFloor: (labOnFloor) => set((st) => ({ labOnFloor, selected: !labOnFloor && st.selected === 'LAB' ? 'L03' : st.selected })),
  setLang: (lang) => set({ lang }),
  setIndex: (index) => set({ index }),
  select: (selected) => set({ selected }),
  decide: (decision) => set({ decision }),
  setRpm: (rpm) => set({ rpm }),
  setScenario: (s) => set((st) => ({ scenario: { ...st.scenario, ...s } })),
  setUseNote: (useNote) => set({ useNote }),
}));

// ---------------------------------------------------------------- tooltip
export interface Tip { x: number; y: number; lead: string; lines: string[] }
interface TipState { tip: Tip | null; show: (t: Tip) => void; hide: () => void }
export const useTip = create<TipState>((set) => ({
  tip: null,
  show: (tip) => set({ tip }),
  hide: () => set({ tip: null }),
}));
export const tipAt = (e: { clientX: number; clientY: number }, lead: string, lines: string[] = []) =>
  useTip.getState().show({ x: e.clientX, y: e.clientY, lead, lines });
export const hideTip = () => useTip.getState().hide();
