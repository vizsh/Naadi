// Live Lab sessions, kept in this browser's IndexedDB: the learned normal and every card the
// session punched. Nothing leaves the device. A session starts when Learn normal finishes (or a
// saved one is resumed) and every new card is appended as it is punched.
import type { LabCard, LabEngine, LearnedNormal } from './engine';

export interface Session {
  id: string;
  /** when the normal was learned, ms since epoch */
  started: number;
  updated: number;
  source: 'mic' | 'demo';
  normal: LearnedNormal;
  cards: LabCard[];
}
/** What the list shows, without the arrays. */
export interface SessionSummary { id: string; started: number; updated: number; source: 'mic' | 'demo'; count: number; watch: number; act: number; recent: LabCard[] }

const DB = 'naadi-lab', STORE = 'sessions', MAX_CARDS = 2000;
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((ok, no) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => ok(req.result);
      req.onerror = () => no(req.error);
    });
  }
  return dbp;
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((ok, no) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}

export const getSession = (id: string) => tx<Session | undefined>('readonly', (s) => s.get(id));
export const putSession = (x: Session) => tx('readwrite', (s) => s.put(x));
export const deleteSession = (id: string) => tx('readwrite', (s) => s.delete(id));
export async function listSessions(): Promise<SessionSummary[]> {
  const all = await tx<Session[]>('readonly', (s) => s.getAll());
  return all
    .map((x) => ({
      id: x.id, started: x.started, updated: x.updated, source: x.source, count: x.cards.length,
      watch: x.cards.filter((c) => c.state === 'watch').length, act: x.cards.filter((c) => c.state === 'act').length,
      recent: x.cards.slice(-40),
    }))
    .sort((a, b) => b.updated - a.updated);
}

// ------------------------------------------------------------ autosave
const changed = new Set<() => void>();
export const onSessionsChanged = (f: () => void) => { changed.add(f); return () => { changed.delete(f); }; };
const announce = () => changed.forEach((f) => f());

let current: { id: string; saved: number } | null = null;
let wired = false;
/** The session the engine is writing to, if any. */
export const currentSessionId = () => current?.id ?? null;

/** Keep the engine's work on the device: one session per learned normal, cards appended as punched. */
export function wireAutosave(engine: LabEngine) {
  if (wired || typeof indexedDB === 'undefined') return;
  wired = true;
  let lastCards: LabCard[] = engine.snap.cards;
  let busy = Promise.resolve();
  engine.subscribe(() => {
    const snap = engine.snap;
    if (snap.phase !== 'watching') { if (snap.phase === 'idle' || snap.phase === 'learning') current = null; lastCards = snap.cards; return; }
    if (snap.cards === lastCards) return;
    const fresh = snap.cards.filter((c) => !lastCards.includes(c));
    lastCards = snap.cards;
    busy = busy.then(async () => {
      try {
        if (!current) {
          const normal = engine.normal();
          if (!normal || !snap.source) return;
          const now = Date.now();
          current = { id: `s${now}`, saved: 0 };
          await putSession({ id: current.id, started: now, updated: now, source: snap.source, normal, cards: fresh });
        } else {
          const x = await getSession(current.id);
          if (!x) return;
          x.cards = [...x.cards, ...fresh].slice(-MAX_CARDS);
          x.updated = Date.now();
          await putSession(x);
        }
        announce();
      } catch (err) { console.error('Could not save the Live Lab session:', err); }
    });
  });
}

/** Resume a saved session: start its sensor, score against its normal, keep appending to it. */
export async function resumeSession(engine: LabEngine, id: string) {
  const x = await getSession(id);
  if (!x) return false;
  await engine.start(x.source);
  current = { id: x.id, saved: x.cards.length };
  const ok = engine.useNormal(x.normal);
  if (!ok) current = null;
  return ok;
}
export async function removeSession(id: string) {
  if (current?.id === id) current = null;
  await deleteSession(id);
  announce();
}
