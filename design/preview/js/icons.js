// Authored icon set: 16px grid, 1.5px stroke, square caps. Status shapes follow
// ISO 3864 vocabulary (square = normal, triangle = warning, circle = act).
const s = (body, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICON = {
  act: s('<circle cx="8" cy="8" r="6.6" fill="var(--act)"/><path d="M8 4.4v4.6" stroke="var(--paper-hi)" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="11.6" r="1.05" fill="var(--paper-hi)"/>', 'st'),
  watch: s('<path d="M8 1.6l6.8 12.2H1.2z" fill="var(--watch)"/><path d="M8 5.8v3.8" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.6" r=".95" fill="var(--ink)"/>', 'st'),
  normal: s('<rect x="2.75" y="2.75" width="10.5" height="10.5" fill="none" stroke="var(--ink-3)" stroke-width="1.5"/>', 'st'),
  off: s('<circle cx="8" cy="8" r="5.4" fill="none" stroke="var(--ink-3)" stroke-width="1.5"/><path d="M4.3 11.7l7.4-7.4" stroke="var(--ink-3)" stroke-width="1.5"/>', 'st'),
  play: s('<path d="M5 3.2v9.6L12.6 8z" fill="currentColor"/>'),
  pause: s('<path d="M4.5 3.5h2.4v9H4.5zM9.1 3.5h2.4v9H9.1z" fill="currentColor"/>'),
  stop: s('<path d="M4 4h8v8H4z" fill="currentColor"/>'),
  check: s('<path d="M3 8.4l3.1 3.1L13 4.6" fill="none" stroke="currentColor" stroke-width="1.7"/>'),
  right: s('<path d="M2.5 8h10.5M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  left: s('<path d="M13.5 8H3M7 4L3 8l4 4" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  speaker: s('<path d="M2 6h2.6L8 3v10L4.6 10H2z" fill="currentColor"/><path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8M12.4 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" stroke-width="1.4"/>'),
  synced: s('<path d="M2.5 8.6l3 3L13.5 3.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 14h12" stroke="currentColor" stroke-width="1.5"/>'),
  wrench: s('<path d="M10.6 1.9a3.3 3.3 0 0 0-3.4 4.4L2 11.5 4.5 14l5.2-5.2a3.3 3.3 0 0 0 4.4-3.4l-2 2-2.1-.6-.6-2.1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'),
  note: s('<path d="M2.5 3h11v7.5H7L4 13v-2.5H2.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 6h6M5 8h4" stroke="currentColor" stroke-width="1.3"/>'),
  person: s('<circle cx="8" cy="5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 14c.6-3 2.6-4.6 5-4.6s4.4 1.6 5 4.6" fill="none" stroke="currentColor" stroke-width="1.4"/>'),
  message: s('<path d="M2.5 3.5h11v7h-6l-3 2.6v-2.6h-2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'),
  table: s('<path d="M2.5 3.5h11v9h-11zM2.5 6.5h11M2.5 9.5h11M6.5 3.5v9" fill="none" stroke="currentColor" stroke-width="1.3"/>'),
  cube: s('<path d="M8 1.8l5.6 3.1v6.2L8 14.2l-5.6-3.1V4.9z M2.4 4.9L8 8l5.6-3.1M8 8v6.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>'),
};
