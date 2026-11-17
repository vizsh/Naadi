'use client';
// React access to the shared Live Lab engine. Selectors must return primitives or stable
// references (the cards array only changes when a card is punched, every two seconds).
import { useCallback, useSyncExternalStore } from 'react';
import { getLabEngine, type Snapshot } from './engine';
import { useNaadi } from '@/lib/store';

export function useLab<T>(select: (s: Snapshot) => T, server: T): T {
  const e = getLabEngine();
  const subscribe = useCallback((cb: () => void) => e.subscribe(cb), [e]);
  return useSyncExternalStore(subscribe, () => select(e.snap), () => server);
}

/** True while the Live Lab's machine is on the floor and punching cards. */
export function useLiveOnFloor() {
  const placed = useNaadi((s) => s.labOnFloor);
  const watching = useLab((s) => s.phase === 'watching', false);
  return placed && watching;
}

/** Take the live machine off the floor and release the microphone. */
export function stopLive() {
  useNaadi.getState().setLabOnFloor(false);
  void getLabEngine().reset();
}
