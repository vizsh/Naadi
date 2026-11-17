'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNaadi } from '@/lib/store';
import { useT } from '@/lib/i18n';
import type { Lang } from '@/lib/model/core';
import { Icon } from './Icons';

// `ready` lists only routes that exist in this build, so the nav never points at a 404.
const NAV: { href: string; key: string; ready: boolean; match: (p: string) => boolean }[] = [
  { href: '/floor', key: 'nav.floor', ready: true, match: (p) => p.startsWith('/floor') },
  { href: '/machine/L03', key: 'nav.case', ready: true, match: (p) => p.startsWith('/machine') },
  { href: '/agents', key: 'nav.agents', ready: false, match: (p) => p.startsWith('/agents') },
  { href: '/lab', key: 'nav.lab', ready: false, match: (p) => p.startsWith('/lab') },
  { href: '/rulebook', key: 'nav.rulebook', ready: false, match: (p) => p.startsWith('/rulebook') },
];
const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'hi', label: 'हिं' },
  { id: 'mr', label: 'मरा' },
];

export function Header() {
  const path = usePathname() || '/';
  const { t, lang } = useT();
  const setLang = useNaadi((s) => s.setLang);
  return (
    <header className="bar" lang={lang}>
      <Link className="brand" href="/" aria-label="NAADI, overview">
        <span className="brand-deva" lang="hi">नाडी</span>
        <span className="brand-latn">NAADI</span>
      </Link>
      <div className="site">
        <strong>Shed 2 · Ichalkaranji</strong>
        <span className="chip">{t('demo')}</span>
      </div>
      <nav className="tabs" aria-label="Views">
        {NAV.filter((n) => n.ready).map((n) => (
          <Link key={n.href} href={n.href} aria-current={n.match(path) ? 'page' : undefined}>
            {t(n.key)}
          </Link>
        ))}
      </nav>
      <div className="bar-end">
        <span className="sync">
          <Icon name="synced" />
          {t('offline')}
        </span>
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
