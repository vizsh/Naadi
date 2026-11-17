'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNaadi } from '@/lib/store';
import { useT } from '@/lib/i18n';
import type { Lang } from '@/lib/model/core';
import { SHEDS } from '@/lib/model/sheds';
import { Icon, StatusIcon } from './Icons';
import { stopLive, useLab, useLiveOnFloor } from '@/lib/lab/live';
import { NetStatus } from './Offline';

// `ready` lists only routes that exist in this build, so the nav never points at a 404.
const NAV: { href: string; key: string; ready: boolean; match: (p: string) => boolean }[] = [
  { href: '/floor', key: 'nav.floor', ready: true, match: (p) => p.startsWith('/floor') },
  { href: '/machine/L03', key: 'nav.case', ready: true, match: (p) => p.startsWith('/machine') },
  { href: '/agents', key: 'nav.agents', ready: true, match: (p) => p.startsWith('/agents') },
  { href: '/lab', key: 'nav.lab', ready: true, match: (p) => p.startsWith('/lab') },
  { href: '/rulebook', key: 'nav.rulebook', ready: true, match: (p) => p.startsWith('/rulebook') },
  { href: '/model', key: 'nav.model', ready: true, match: (p) => p.startsWith('/model') },
];
const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'hi', label: 'हिं' },
  { id: 'mr', label: 'मरा' },
];

/** While the Live Lab's machine is on the floor, the header says so and offers to stop it. */
function LiveChip({ onLab }: { onLab: boolean }) {
  const live = useLiveOnFloor();
  const state = useLab((s) => s.cards[s.cards.length - 1]?.state ?? 'normal', 'normal');
  const source = useLab((s) => s.source, null);
  if (!live) return null;
  return (
    <span className="live-chip">
      <StatusIcon state={state} size={13} />
      {onLab ? <span>Live machine on the floor</span> : <Link href="/lab">Live · {source === 'mic' ? 'microphone' : 'synthesised fan'}</Link>}
      <button type="button" onClick={stopLive} aria-label="Stop the live machine and release the sensor">Stop</button>
    </span>
  );
}

export function Header() {
  const path = usePathname() || '/';
  const { t, lang } = useT();
  const setLang = useNaadi((s) => s.setLang);
  const shed = SHEDS[useNaadi((s) => s.setup.shed)];
  return (
    <header className="bar" lang={lang}>
      <Link className="brand" href="/" aria-label="NAADI, overview">
        <span className="brand-deva" lang="hi">नाडी</span>
        <span className="brand-latn">NAADI</span>
      </Link>
      <div className="site">
        <strong>{shed.place}</strong>
        <span className="chip">{t('demo')}</span>
      </div>
      <nav className="tabs" aria-label="Views">
        {NAV.filter((n) => n.ready).map((n) => (
          <Link key={n.href} href={n.key === 'nav.case' ? `/machine/${shed.hero}` : n.href} aria-current={n.match(path) ? 'page' : undefined}>
            {t(n.key)}
          </Link>
        ))}
      </nav>
      <div className="bar-end">
        <LiveChip onLab={path.startsWith('/lab')} />
        <NetStatus />
        <div className="seg lang" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
