'use client';
// App-wide state: language, the replay index, the selected machine, the owner's decision,
// the case file's speed control and the what-if scenario the agents plan against.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { N_PAST, inr, type Lang } from './model/core';
import { BASE_SCENARIO, costs, type Scenario } from './model/decide';
import { getModel } from './model';
import { DEFAULT_SETUP, type Setup } from './model/setup';

export type Decision = 'open' | 'approved' | 'snoozed';
/** One entry in the owner's decision log, kept on this device. */
export interface LogEntry { at: string; decision: Decision; window: string; expected: string; scenario: Scenario }

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
  /** every approve, not now and undo, newest last, kept on this device */
  log: LogEntry[];
  clearLog: () => void;
  /** the demo's setup: fault, wear, power, floor and seed (setup.ts) */
  setup: Setup;
  setSetup: (s: Partial<Setup>) => void;
  setLang: (l: Lang) => void;
  setIndex: (k: number) => void;
  select: (id: string) => void;
  decide: (d: Decision) => void;
  setRpm: (r: number) => void;
  setScenario: (s: Partial<Scenario>) => void;
  setUseNote: (v: boolean) => void;
}

// The owner's decision, the what-ifs, the language and the decision log survive a reload and
// work offline: they are kept in this browser's localStorage. Rehydration waits for the client
// (see Persistence), so the server-rendered page and the first client render always agree.
export const useNaadi = create<NaadiState>()(persist((set) => ({
  lang: 'en',
  index: N_PAST - 1,
  selected: 'L03',
  decision: 'open',
  rpm: null,
  scenario: BASE_SCENARIO,
  useNote: true,
  labOnFloor: false,
  log: [],
  setup: DEFAULT_SETUP,
  // a new setup is a new shed: start its story fresh
  setSetup: (p) => set((st) => ({ setup: { ...st.setup, ...p }, decision: 'open', index: N_PAST - 1, selected: 'L03', rpm: null, labOnFloor: false })),
  setLabOnFloor: (labOnFloor) => set((st) => ({ labOnFloor, selected: !labOnFloor && st.selected === 'LAB' ? 'L03' : st.selected })),
  setLang: (lang) => set({ lang }),
  setIndex: (index) => set({ index }),
  select: (selected) => set({ selected }),
  decide: (decision) => set((st) => {
    if (decision === st.decision) return {};
    const best = costs(getModel().loom.rul!, st.scenario).best;
    const entry: LogEntry = { at: new Date().toISOString(), decision, window: best.when, expected: inr(best.E), scenario: st.scenario };
    return { decision, log: [...st.log.slice(-39), entry] };
  }),
  clearLog: () => set({ log: [] }),
  setRpm: (rpm) => set({ rpm }),
  setScenario: (s) => set((st) => ({ scenario: { ...st.scenario, ...s } })),
  setUseNote: (useNote) => set({ useNote }),
}), {
  name: 'naadi-v1',
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
  partialize: (st) => ({ lang: st.lang, decision: st.decision, scenario: st.scenario, useNote: st.useNote, log: st.log, setup: st.setup }),
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
