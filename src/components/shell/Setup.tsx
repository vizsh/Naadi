'use client';
// The setup bar: choose Loom 03's fault, how fast it wears, how the power behaves and how noisy
// the floor is, or draw another fortnight. Everything below is rebuilt from the choice. The
// setup rides in the address bar so it can be shared, and is remembered on this device.
import { Fragment, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useNaadi } from '@/lib/store';
import { DEFAULT_SETUP, FAULTS, FLOOR, POWER_LABEL, WEAR, isDefault, setActiveSetup, setupKey, setupToQuery, type FaultId, type Floor, type Power, type Wear } from '@/lib/model/setup';
import { Icon } from './Icons';

/** Sets the active setup before the pages render, and rebuilds them when it changes. */
export function SetupScope({ children }: { children: React.ReactNode }) {
  const setup = useNaadi((s) => s.setup);
  setActiveSetup(setup);
  return <Fragment key={setupKey(setup)}>{children}</Fragment>;
}

export function SetupBar() {
  const setup = useNaadi((s) => s.setup);
  const setSetup = useNaadi((s) => s.setSetup);
  const path = usePathname();
  // keep the address bar in step, so the setup can be shared
  useEffect(() => {
    const q = setupToQuery(setup);
    const want = path + (q ? `?${q}` : '');
    if (window.location.pathname + window.location.search !== want) window.history.replaceState(null, '', want);
  }, [setup, path]);
  const sel = <K extends 'fault' | 'power'>(k: K, options: [string, string][], label: string) => (
    <label className="setup-field">
      <span>{label}</span>
      <select value={setup[k]} onChange={(e) => setSetup({ [k]: e.target.value } as never)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  return (
    <div className="setup-bar" role="region" aria-label="Demo setup">
      {sel('fault', (Object.keys(FAULTS) as FaultId[]).map((f) => [f, FAULTS[f].label]), "Loom 03's fault")}
      <div className="setup-field">
        <span id="sb-wear">Wear</span>
        <div className="seg" role="group" aria-labelledby="sb-wear">
          {(Object.keys(WEAR) as Wear[]).map((w) => <button key={w} type="button" aria-pressed={setup.wear === w} onClick={() => setSetup({ wear: w })}>{WEAR[w].label}</button>)}
        </div>
      </div>
      {sel('power', (Object.keys(POWER_LABEL) as Power[]).map((p) => [p, POWER_LABEL[p]]), 'Power')}
      <div className="setup-field">
        <span id="sb-floor">Floor</span>
        <div className="seg" role="group" aria-labelledby="sb-floor">
          {(Object.keys(FLOOR) as Floor[]).map((f) => <button key={f} type="button" aria-pressed={setup.floor === f} onClick={() => setSetup({ floor: f })}>{FLOOR[f].label}</button>)}
        </div>
      </div>
      <button type="button" className="btn setup-dice" onClick={() => setSetup({ seed: 1 + Math.floor(Math.random() * 2 ** 30) })}><Icon name="spark" />Another fortnight</button>
      {!isDefault(setup) && <button type="button" className="btn-quiet" onClick={() => setSetup(DEFAULT_SETUP)}>Back to the demo</button>}
      <span className="setup-note">{isDefault(setup) ? 'The original demo shed.' : `Fortnight ${setup.seed}.`} Every reading is synthetic and rebuilt from these choices; the maths is the same.</span>
    </div>
  );
}
