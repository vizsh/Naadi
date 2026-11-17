'use client';
// Works on a bad day. Persistence restores the owner's decision, the what-ifs, the language and
// the decision log from this device after the first render, and registers the service worker
// that keeps every page available without signal. NetStatus tells the truth about both.
import { useEffect, useSyncExternalStore } from 'react';
import { useNaadi } from '@/lib/store';
import { setupFromQuery } from '@/lib/model/setup';
import { useT } from '@/lib/i18n';
import { Icon } from './Icons';

type Sw = 'none' | 'installing' | 'ready';
let swState: Sw = 'none';
const swListeners = new Set<() => void>();
const setSw = (s: Sw) => { swState = s; swListeners.forEach((f) => f()); };

export function Persistence() {
  useEffect(() => {
    // the device's saved state first, then a setup in the address bar wins (a shared link)
    const q = new URLSearchParams(window.location.search); // read before the bar rewrites the address
    void Promise.resolve(useNaadi.persist.rehydrate()).then(() => {
      if (['shed', 'fault', 'wear', 'power', 'floor', 'seed'].some((k) => q.has(k))) useNaadi.getState().setSetup(setupFromQuery(q));
    });
    // the service worker only in production builds: in development it would cache stale code
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    setSw('installing');
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready)
      .then(() => setSw('ready'))
      .catch((err) => { console.error('Offline cache unavailable:', err); setSw('none'); });
  }, []);
  return null;
}

const subOnline = (cb: () => void) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; };
const subSw = (cb: () => void) => { swListeners.add(cb); return () => { swListeners.delete(cb); }; };

export function NetStatus() {
  const { t } = useT();
  const online = useSyncExternalStore(subOnline, () => navigator.onLine, () => true);
  const sw = useSyncExternalStore(subSw, () => swState, () => 'none' as Sw);
  const text = !online ? t('net.offline') : sw === 'ready' ? t('net.ready') : sw === 'installing' ? t('net.saving') : t('net.online');
  return (
    <span className={`sync${online ? '' : ' is-offline'}`} role="status">
      <Icon name="synced" />
      {text}
    </span>
  );
}
