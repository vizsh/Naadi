// Authored icon set: 16px grid, 1.5px stroke. Status shapes follow ISO 3864:
// square = normal, triangle = watch, circle = act, struck circle = off.
import type { State } from '@/lib/model/core';

export function Sprite() {
  return (
    <svg className="sprite" width="0" height="0" aria-hidden="true" focusable="false">
      <symbol id="i-act" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6.6" fill="var(--act)" />
        <path d="M8 4.4v4.6" stroke="var(--paper-hi)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.6" r="1.05" fill="var(--paper-hi)" />
      </symbol>
      <symbol id="i-watch" viewBox="0 0 16 16">
        <path d="M8 1.6l6.8 12.2H1.2z" fill="var(--watch)" />
        <path d="M8 5.8v3.8" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="11.6" r=".95" fill="var(--ink)" />
      </symbol>
      <symbol id="i-normal" viewBox="0 0 16 16">
        <rect x="2.75" y="2.75" width="10.5" height="10.5" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" />
      </symbol>
      <symbol id="i-off" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="5.4" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" />
        <path d="M4.3 11.7l7.4-7.4" stroke="var(--ink-3)" strokeWidth="1.5" />
      </symbol>
      <symbol id="i-note-ink" viewBox="0 0 16 16">
        <path d="M2.5 3h11v7.5H7L4 13v-2.5H2.5z" fill="var(--paper-hi)" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M5 6h6M5 8h4" stroke="var(--ink)" strokeWidth="1.3" />
      </symbol>
    </svg>
  );
}

export function StatusIcon({ state, size = 16 }: { state: State; size?: number }) {
  return (
    <svg className="ico st" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <use href={`#i-${state}`} />
    </svg>
  );
}

const P: Record<string, React.ReactNode> = {
  play: <path d="M5 3.2v9.6L12.6 8z" fill="currentColor" />,
  pause: <path d="M4.5 3.5h2.4v9H4.5zM9.1 3.5h2.4v9H9.1z" fill="currentColor" />,
  stop: <path d="M4 4h8v8H4z" fill="currentColor" />,
  check: <path d="M3 8.4l3.1 3.1L13 4.6" fill="none" stroke="currentColor" strokeWidth="1.7" />,
  right: <path d="M2.5 8h10.5M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  left: <path d="M13.5 8H3M7 4L3 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  speaker: (
    <>
      <path d="M2 6h2.6L8 3v10L4.6 10H2z" fill="currentColor" />
      <path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8M12.4 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  synced: (
    <>
      <path d="M2.5 8.6l3 3L13.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14h12" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  wrench: <path d="M10.6 1.9a3.3 3.3 0 0 0-3.4 4.4L2 11.5 4.5 14l5.2-5.2a3.3 3.3 0 0 0 4.4-3.4l-2 2-2.1-.6-.6-2.1z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
  note: (
    <>
      <path d="M2.5 3h11v7.5H7L4 13v-2.5H2.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 6h6M5 8h4" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  person: (
    <>
      <circle cx="8" cy="5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 14c.6-3 2.6-4.6 5-4.6s4.4 1.6 5 4.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  message: <path d="M2.5 3.5h11v7h-6l-3 2.6v-2.6h-2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
  table: <path d="M2.5 3.5h11v9h-11zM2.5 6.5h11M2.5 9.5h11M6.5 3.5v9" fill="none" stroke="currentColor" strokeWidth="1.3" />,
  mic: (
    <>
      <rect x="5.5" y="1.8" width="5" height="8" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.4 7.6a4.6 4.6 0 0 0 9.2 0M8 12.2v2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  phone: (
    <>
      <rect x="4.2" y="1.6" width="7.6" height="12.8" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 12.2h2" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  eye: (
    <>
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </>
  ),
  explode: <path d="M2 8h3M11 8h3M5 5.5h6v5H5zM2.5 6.5L1 8l1.5 1.5M13.5 6.5L15 8l-1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />,
  github: <path d="M8 1.5a6.5 6.5 0 0 0-2.05 12.67c.33.06.45-.14.45-.31v-1.1c-1.81.39-2.19-.87-2.19-.87-.3-.75-.72-.95-.72-.95-.59-.4.04-.39.04-.39.65.05 1 .67 1 .67.58 1 1.52.71 1.89.54.06-.42.23-.71.41-.87-1.45-.17-2.97-.72-2.97-3.21 0-.71.25-1.29.67-1.75-.07-.16-.29-.83.06-1.72 0 0 .55-.18 1.79.67a6.2 6.2 0 0 1 3.26 0c1.24-.85 1.79-.67 1.79-.67.35.89.13 1.56.06 1.72.42.46.67 1.04.67 1.75 0 2.5-1.53 3.04-2.98 3.2.24.2.44.6.44 1.21v1.8c0 .17.12.37.45.31A6.5 6.5 0 0 0 8 1.5z" fill="currentColor" />,
  spark: <path d="M8 1.5v4M8 10.5v4M1.5 8h4M10.5 8h4M3.4 3.4l2.4 2.4M10.2 10.2l2.4 2.4M3.4 12.6l2.4-2.4M10.2 5.8l2.4-2.4" fill="none" stroke="currentColor" strokeWidth="1.3" />,
};

export function Icon({ name, size = 16, className = '' }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg className={`ico ${className}`} viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}
