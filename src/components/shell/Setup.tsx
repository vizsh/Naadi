'use client';
// The setup bar: choose the shed, its hero machine's fault, the order book, what is listening, how fast it wears, how the power behaves and how noisy
// the floor is, or draw another fortnight. Everything below is rebuilt from the choice. The
// setup rides in the address bar so it can be shared, and is remembered on this device.
import { Fragment, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useNaadi } from '@/lib/store';
import { SHEDS, SHED_IDS, type ShedId } from '@/lib/model/sheds';
import { DEFAULT_SETUP, FAULTS, FLOOR, KIT, ORDERS, POWER_LABEL, WEAR, isDefault, setActiveSetup, setupKey, setupToQuery, type FaultId, type Floor, type Kit, type Orders, type Power, type Wear } from '@/lib/model/setup';
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
  const router = useRouter();
  const shed = SHEDS[setup.shed];
  // a case-file move in flight: the address bar waits for it rather than rewriting the old path
  const moving = useRef<string | null>(null);
  // keep the address bar in step, so the setup can be shared
  useEffect(() => {
    if (moving.current && path !== moving.current) return;
    moving.current = null;
    const q = setupToQuery(setup);
    const want = path + (q ? `?${q}` : '');
    if (window.location.pathname + window.location.search !== want) window.history.replaceState(null, '', want);
  }, [setup, path]);
  const sel = <K extends 'shed' | 'fault' | 'power'>(k: K, options: [string, string][], label: string) => (
    <label className="setup-field">
      <span>{label}</span>
      <select name={k} value={setup[k]} onChange={(e) => change(k, e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  const go = (to: string, next: typeof setup) => {
    moving.current = to;
    const q = setupToQuery(next);
    router.replace(to + (q ? `?${q}` : ''));
  };
  // a new kind of shed has other machines: a case file open on the old one moves to the new hero
  const change = (k: 'shed' | 'fault' | 'power', v: string) => {
    const next = { ...setup, [k]: v } as typeof setup;
    if (k === 'shed' && path.startsWith('/machine/')) go(`/machine/${SHEDS[v as ShedId].hero}`, next);
    setSetup({ [k]: v } as never);
  };
  return (
    <div className="setup-bar" role="region" aria-label="Demo setup">
      {sel('shed', SHED_IDS.map((s) => [s, SHEDS[s].label]), 'Shed')}
      {sel('fault', (Object.keys(FAULTS) as FaultId[]).map((f) => [f, FAULTS[f].label]), `${shed.heroName.en}'s fault`)}
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
      <div className="setup-field">
        <span id="sb-orders">Orders</span>
        <div className="seg" role="group" aria-labelledby="sb-orders">
          {(Object.keys(ORDERS) as Orders[]).map((o) => <button key={o} type="button" aria-pressed={setup.orders === o} title={ORDERS[o].note} onClick={() => setSetup({ orders: o })}>{ORDERS[o].label}</button>)}
        </div>
      </div>
      <div className="setup-field">
        <span id="sb-kit">Listening with</span>
        <div className="seg" role="group" aria-labelledby="sb-kit">
          {(Object.keys(KIT) as Kit[]).map((k) => <button key={k} type="button" aria-pressed={setup.kit === k} title={KIT[k].note} onClick={() => setSetup({ kit: k })}>{KIT[k].label}</button>)}
        </div>
      </div>
      <button type="button" className="btn setup-dice" onClick={() => setSetup({ seed: 1 + Math.floor(Math.random() * 2 ** 30) })}><Icon name="spark" />Another fortnight</button>
      {!isDefault(setup) && <button type="button" className="btn-quiet" onClick={() => { if (setup.shed !== DEFAULT_SETUP.shed && path.startsWith('/machine/')) go(`/machine/${SHEDS[DEFAULT_SETUP.shed].hero}`, DEFAULT_SETUP); setSetup(DEFAULT_SETUP); }}>Back to the demo</button>}
      <span className="setup-note">{shed.about}. {isDefault(setup) ? 'The original demo.' : `Fortnight ${setup.seed}.`} Every reading is synthetic and rebuilt from these choices; the maths is the same.</span>
    </div>
  );
}
