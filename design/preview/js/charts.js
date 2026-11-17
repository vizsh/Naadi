// NAADI preview charts. Hand-built SVG on point paper: the chart grid is the
// paper's own grid, marks are ink, and colour appears only for watch / act.
import * as M from './model.js';

const INK = '#17191C', INK3 = '#656B72', PAPER = '#F3F4EF', SLOT = '#E2E6DD';
const WATCH = '#D99A00', ACT = '#C8372A', BASE = '#80837B';
const GRID = 'rgba(64,108,98,.11)', GRID_B = 'rgba(64,108,98,.26)';
const COLS = M.N_PAST + M.N_AHEAD;
const fill = { normal: SLOT, watch: WATCH, act: ACT };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------------------------------------------------------------- tooltip
const tip = () => document.querySelector('.tip');
export function showTip(evt, lead, lines = []) {
  const t = tip();
  t.replaceChildren();
  const b = document.createElement('strong');
  b.textContent = lead;
  t.appendChild(b);
  for (const l of lines) {
    const p = document.createElement('span');
    p.textContent = l;
    t.appendChild(p);
  }
  t.hidden = false;
  const r = t.getBoundingClientRect();
  let x = evt.clientX + 14, y = evt.clientY + 16;
  if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - 12;
  t.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
export const hideTip = () => { tip().hidden = true; };

// ------------------------------------------------------ card column layout
// Cards are laid like point paper: a 2px gap between cards, an extra 2px at
// each midnight, and a wider gap at "now" before the blank forecast cards.
function columns(labelW, pitch) {
  const xs = [];
  let x = labelW;
  for (let k = 0; k < COLS; k++) {
    if (k > 0 && (k - 2) % 4 === 0) x += 2;
    if (k === M.N_PAST) x += 10;
    xs.push(x);
    x += pitch;
  }
  return { xs, end: x };
}
function dayLabels(xs, pitch, y) {
  let out = '';
  for (let k = 2; k < COLS; k += 4) {
    const ms = M.cardStart(k);
    const p = M.ist(ms);
    const long = pitch * 4 >= 38;
    const sunday = p.wd === 0;
    const txt = long ? `${M.weekday(ms)} ${p.day}` : String(p.day);
    out += `<text x="${xs[k] + 1}" y="${y}" class="t-axis${sunday ? ' t-sun' : ''}">${txt}</text>`;
  }
  return out;
}
const HATCH = (id) =>
  `<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#E9ECE4"/><path d="M0 0v4" stroke="#9BA19A" stroke-width="1.1"/></pattern>`;

function holeR(n, cell) {
  if (!n) return 0;
  return cell * (n === 1 ? 0.17 : n <= 3 ? 0.25 : 0.33);
}

// ----------------------------------------------------- shed card record
// Machine labels live in their own fixed SVG so they stay put while the
// card grid scrolls sideways on narrow screens.
export function renderDrawdown(labels, svg, model, { index, selected, approved, labelText }) {
  const host = svg.parentElement;
  const W = host.clientWidth;
  const labelW = W < 640 ? 84 : 104;
  // 26 midnight gaps (2px), the "now" gap (10px) and margins come out of the width first
  const pitch = Math.max(W < 640 ? 10 : 8, Math.min(13, Math.floor((W - 82) / COLS)));
  const cell = pitch - 2;
  const row = Math.max(cell + 5, 15);
  const top = 34;
  const { xs, end } = columns(4, pitch);
  const rows = model.machines.length;
  const H = top + rows * row + 40;
  const width = Math.max(W, end + 8);
  svg.setAttribute('width', width);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  labels.setAttribute('width', labelW);
  labels.setAttribute('height', H);
  labels.setAttribute('viewBox', `0 0 ${labelW} ${H}`);
  const nowX = xs[M.N_PAST] - 6;
  const live = index === M.N_PAST - 1;
  let o = `<defs>${HATCH('hatch-d')}</defs>`;
  let lab = '';
  o += `<text x="${xs[0]}" y="11" class="t-cap">Punched · one card per 6 h</text>`;
  o += `<text x="${xs[M.N_PAST]}" y="11" class="t-cap">Ahead · blank cards, not yet punched</text>`;
  o += dayLabels(xs, pitch, 26);
  // the planned repair column: Thursday's power cut
  const rx = xs[M.REPAIR_CARD];
  o += `<rect x="${rx - 2}" y="${top - 4}" width="${cell + 4}" height="${rows * row + 2}" fill="#E9ECE4"/>`;
  model.machines.forEach((m, i) => {
    const y = top + i * row;
    const sel = m.id === selected;
    const stNow = live ? m.now.state : m.cards[index].off ? 'off' : m.cards[index].state;
    lab += `<g class="dd-label${sel ? ' is-sel' : ''}" data-m="${m.id}" role="button" tabindex="0" aria-pressed="${sel}" aria-label="${esc(m.name)}, ${esc(labelText ? labelText(stNow) : stNow)}">`;
    lab += `<rect x="0" y="${y - 2}" width="${labelW - 6}" height="${row}" fill="transparent"/>`;
    lab += `<use href="#i-${stNow}" x="0" y="${y + cell / 2 - 7}" width="14" height="14"/>`;
    lab += `<text x="20" y="${y + cell / 2 + 4}" class="t-row">${esc(m.name)}</text></g>`;
    for (let k = 0; k < COLS; k++) {
      const x = xs[k];
      if (k < M.N_PAST) {
        const c = m.cards[k];
        if (k > index) {
          o += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${cell - 1}" height="${cell - 1}" class="c-blank" data-m="${m.id}" data-k="${k}"/>`;
          continue;
        }
        const f = c.off ? 'url(#hatch-d)' : fill[c.state];
        o += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${f}" data-m="${m.id}" data-k="${k}"/>`;
        const r = holeR(c.n, cell);
        if (r) o += `<circle cx="${x + cell / 2}" cy="${y + cell / 2}" r="${r.toFixed(2)}" fill="${INK}" pointer-events="none"/>`;
      } else {
        const off = M.offReason(k);
        const dim = live ? '' : ' style="opacity:.3"';
        if (m.id === 'L03' && k === M.REPAIR_CARD) {
          o += approved
            ? `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${INK}" data-m="${m.id}" data-k="${k}"${dim}/><path d="M${x + cell * 0.22} ${y + cell * 0.52}l${cell * 0.2} ${cell * 0.2} ${cell * 0.36} -${cell * 0.42}" stroke="${PAPER}" stroke-width="1.4" fill="none" pointer-events="none"/>`
            : `<rect x="${x + 0.75}" y="${y + 0.75}" width="${cell - 1.5}" height="${cell - 1.5}" fill="none" stroke="${INK}" stroke-width="1.5" data-m="${m.id}" data-k="${k}"${dim}/>`;
          continue;
        }
        if (off) o += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="url(#hatch-d)" opacity=".55" data-m="${m.id}" data-k="${k}"${dim}/>`;
        else o += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${cell - 1}" height="${cell - 1}" class="c-blank" data-m="${m.id}" data-k="${k}"${dim}/>`;
      }
    }
  });
  const bottom = top + rows * row;
  o += `<line x1="${nowX}" x2="${nowX}" y1="${top - 8}" y2="${bottom}" stroke="${INK}" stroke-width="1.5"/>`;
  if (!live) {
    const ix = xs[index] + cell + 1;
    o += `<line x1="${ix}" x2="${ix}" y1="${top - 8}" y2="${bottom}" stroke="${INK}" stroke-width="1" stroke-dasharray="3 2"/>`;
  }
  // Loom 03: the time-to-failure spread laid over its blank cards.
  const li = model.machines.findIndex((m) => m.id === 'L03');
  if (live && li >= 0) {
    const r = model.rul;
    const cx = (days) => {
      const k = M.N_PAST + days * 4;
      const kk = Math.min(COLS - 1, Math.floor(k));
      return xs[kk] + (k - kk) * pitch;
    };
    const yb = top + li * row + cell / 2;
    const a = cx(r.p10), b = cx(r.p90), c = cx(r.p50);
    o += `<line x1="${a}" x2="${b}" y1="${yb}" y2="${yb}" stroke="${ACT}" stroke-width="2"/>`;
    o += `<line x1="${a}" x2="${a}" y1="${yb - 5}" y2="${yb + 5}" stroke="${ACT}" stroke-width="2"/>`;
    o += `<line x1="${b}" x2="${b}" y1="${yb - 5}" y2="${yb + 5}" stroke="${ACT}" stroke-width="2"/>`;
    o += `<rect x="${c - 3.5}" y="${yb - 3.5}" width="7" height="7" fill="${ACT}" transform="rotate(45 ${c} ${yb})"/>`;
    const ly = bottom + 15;
    o += `<text x="${rx + cell / 2}" y="${ly}" class="t-cap" text-anchor="middle">${approved ? 'Repair booked' : 'Repair window'}</text>`;
    o += `<text x="${a}" y="${ly}" class="t-num" text-anchor="middle">P10 ${r.p10.toFixed(1)} d</text>`;
    o += `<text x="${c}" y="${ly}" class="t-num" text-anchor="middle">P50 ${r.p50.toFixed(1)} d</text>`;
    o += `<text x="${b}" y="${ly}" class="t-num" text-anchor="middle">P90 ${r.p90.toFixed(1)} d</text>`;
    o += `<text x="${(a + b) / 2}" y="${ly + 16}" class="t-cap" text-anchor="middle">Loom 03 failure window, P10 to P90</text>`;
  }
  svg.innerHTML = o;
  labels.innerHTML = lab;
  return { pitch, xs };
}

export function drawdownTip(evt, model, index) {
  const t = evt.target.closest('[data-k]');
  if (!t) return hideTip();
  const m = model.byId[t.dataset.m];
  const k = Number(t.dataset.k);
  if (k >= M.N_PAST) {
    const lines = [`${m.name} · ${M.cardLabel(k)}`];
    const off = M.offReason(k);
    if (off) lines.push(off);
    if (m.id === 'L03') {
      const days = (k + 1 - M.N_PAST) / 4;
      lines.push(`P(failed by the end of this card) ${M.pct(model.rul.cdf(days))}`);
    }
    const lead = m.id === 'L03' && k === M.REPAIR_CARD ? 'Planned repair, 14:00–18:00' : 'Not yet punched';
    return showTip(evt, lead, lines);
  }
  const c = m.cards[k];
  if (k > index) return showTip(evt, 'Not yet punched at this point in the replay', [`${m.name} · ${M.cardLabel(k)}`]);
  if (c.off) return showTip(evt, 'Machine off', [`${m.name} · card ${k + 1} of 56`, M.cardLabel(k), M.offReason(k)]);
  const names = M.CHANNELS.filter((_, i) => c.holes[i]).map((ch) => ch.short);
  showTip(evt, c.state === 'act' ? 'Act' : c.state === 'watch' ? 'Watch' : 'Normal', [
    `${m.name} · card ${k + 1} of 56`,
    M.cardLabel(k),
    names.length ? `Holes: ${names.join(', ')}` : 'No holes: every channel inside its normal',
    `Degradation index ${c.dS.toFixed(3)}`,
  ]);
}

// ------------------------------------------------- one machine, by channel
export function renderChain(svg, model, { approved }) {
  const m = model.byId.L03;
  const host = svg.parentElement;
  const W = host.clientWidth;
  const labelW = 78;
  const pitch = Math.max(8, Math.min(13, Math.floor((W - labelW - 70) / COLS)));
  const cell = pitch - 2, row = Math.max(cell + 4, 15), top = 40;
  const { xs, end } = columns(labelW, pitch);
  const width = Math.max(W, end + 8);
  const rowsY = (i) => top + 10 + i * row;
  const bottom = rowsY(M.CHANNELS.length);
  const H = bottom + 46;
  svg.setAttribute('width', width);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  let o = `<defs>${HATCH('hatch-c')}</defs>`;
  o += dayLabels(xs, pitch, 24);
  // the card's paint edge: state of each card
  for (let k = 0; k < M.N_PAST; k++) {
    const c = m.cards[k];
    const f = c.off ? 'url(#hatch-c)' : c.state === 'normal' ? '#B9C2C6' : fill[c.state];
    o += `<rect x="${xs[k]}" y="${top}" width="${cell}" height="5" fill="${f}" data-k="${k}" data-ch="-1"/>`;
  }
  M.CHANNELS.forEach((ch, i) => {
    const y = rowsY(i);
    o += `<text x="0" y="${y + cell / 2 + 4}" class="t-row">${ch.short}</text>`;
    for (let k = 0; k < COLS; k++) {
      const x = xs[k];
      if (k >= M.N_PAST) {
        if (k === M.REPAIR_CARD) o += `<rect x="${x + 0.75}" y="${y + 0.75}" width="${cell - 1.5}" height="${cell - 1.5}" fill="${approved ? INK : 'none'}" stroke="${INK}" stroke-width="1.5"/>`;
        else o += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${cell - 1}" height="${cell - 1}" class="c-blank"/>`;
        continue;
      }
      const c = m.cards[k];
      o += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${c.off ? 'url(#hatch-c)' : SLOT}" data-k="${k}" data-ch="${i}"/>`;
      if (c.holes[i]) o += `<circle cx="${x + cell / 2}" cy="${y + cell / 2}" r="${(cell * 0.3).toFixed(2)}" fill="${INK}" pointer-events="none"/>`;
    }
  });
  const nowX = xs[M.N_PAST] - 6;
  o += `<line x1="${nowX}" x2="${nowX}" y1="${top - 6}" y2="${bottom}" stroke="${INK}" stroke-width="1.5"/>`;
  // change point and the worker's note
  if (model.ph) {
    const ax = xs[model.ph.alarm] + cell / 2, ox = xs[model.ph.onset] + cell / 2;
    o += `<line x1="${ox}" x2="${ox}" y1="${top - 6}" y2="${bottom + 8}" stroke="${INK3}" stroke-dasharray="2 3"/>`;
    o += `<line x1="${ax}" x2="${ax}" y1="${top - 6}" y2="${bottom + 22}" stroke="${INK}"/>`;
    o += `<text x="${ox - 4}" y="${bottom + 18}" class="t-cap" text-anchor="end">Wear began · card ${model.ph.onset + 1}</text>`;
    o += `<text x="${ax + 4}" y="${bottom + 32}" class="t-cap">Change detected · card ${model.ph.alarm + 1}</text>`;
  }
  const nk = model.notes[0].k;
  const nx = xs[nk] + cell / 2;
  o += `<path d="M${nx} ${bottom + 4}v6" stroke="${INK}"/><use href="#i-note-ink" x="${nx - 7}" y="${bottom + 10}" width="14" height="14"/>`;
  // failure window over the blank cards
  const r = model.rul;
  const cx = (days) => {
    const k = M.N_PAST + days * 4;
    const kk = Math.min(COLS - 1, Math.floor(k));
    return xs[kk] + (k - kk) * pitch;
  };
  const yb = bottom + 14;
  const a = cx(r.p10), b = cx(r.p90), c = cx(r.p50);
  o += `<line x1="${a}" x2="${b}" y1="${yb}" y2="${yb}" stroke="${ACT}" stroke-width="2"/><line x1="${a}" x2="${a}" y1="${yb - 5}" y2="${yb + 5}" stroke="${ACT}" stroke-width="2"/><line x1="${b}" x2="${b}" y1="${yb - 5}" y2="${yb + 5}" stroke="${ACT}" stroke-width="2"/><rect x="${c - 3.5}" y="${yb - 3.5}" width="7" height="7" fill="${ACT}" transform="rotate(45 ${c} ${yb})"/>`;
  o += `<text x="${a}" y="${yb + 20}" class="t-num" text-anchor="middle">P10 ${r.p10.toFixed(1)} d</text><text x="${c}" y="${yb + 20}" class="t-num" text-anchor="middle">P50 ${r.p50.toFixed(1)} d</text><text x="${b}" y="${yb + 20}" class="t-num" text-anchor="middle">P90 ${r.p90.toFixed(1)} d</text>`;
  svg.innerHTML = o;
}

export function chainTip(evt, model) {
  const t = evt.target.closest('[data-k]');
  if (!t) return hideTip();
  const m = model.byId.L03;
  const k = Number(t.dataset.k), ch = Number(t.dataset.ch);
  const c = m.cards[k];
  if (c.off) return showTip(evt, 'Machine off', [M.cardLabel(k), M.offReason(k)]);
  if (ch < 0) return showTip(evt, c.state === 'act' ? 'Act' : c.state === 'watch' ? 'Watch' : 'Normal', [`Card ${k + 1} of 56 · ${M.cardLabel(k)}`, `Degradation index ${c.dS.toFixed(3)}`]);
  const C = M.CHANNELS[ch];
  showTip(evt, c.holes[ch] ? 'Hole punched' : 'Within normal', [`${C.name} · card ${k + 1} of 56`, M.cardLabel(k), c.holes[ch] ? 'Tail probability under 0.01 for this regime' : 'Inside the learned band for this regime']);
}

// ------------------------------------------------------- envelope spectrum
export function renderSpectrum(svg, spec, { rpm }) {
  const W = svg.parentElement.clientWidth;
  const H = Math.round(Math.max(300, Math.min(460, W * 0.44)));
  const m = { l: 52, r: 18, t: 46, b: 40 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const y0 = -68, y1 = -38;
  const X = (f) => m.l + (f / spec.fmax) * pw;
  const Y = (db) => m.t + (1 - (db - y0) / (y1 - y0)) * ph;
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  let o = '';
  // point paper aligned to the data: fine every 10 Hz and 1 dB, bold every 50 Hz and 5 dB
  for (let f = 0; f <= spec.fmax; f += 10) o += `<line x1="${X(f)}" x2="${X(f)}" y1="${m.t}" y2="${m.t + ph}" stroke="${f % 50 ? GRID : GRID_B}"/>`;
  for (let d = y0; d <= y1; d += 1) o += `<line x1="${m.l}" x2="${m.l + pw}" y1="${Y(d)}" y2="${Y(d)}" stroke="${d % 5 ? GRID : GRID_B}"/>`;
  for (let f = 0; f <= spec.fmax; f += 50) o += `<text x="${X(f)}" y="${m.t + ph + 18}" class="t-num" text-anchor="middle">${f}</text>`;
  for (let d = -65; d <= y1; d += 5) o += `<text x="${m.l - 8}" y="${Y(d) + 4}" class="t-num" text-anchor="end">${d}</text>`;
  o += `<text x="${m.l + pw}" y="${H - 6}" class="t-cap" text-anchor="end">Frequency, Hz</text>`;
  o += `<text x="${m.l - 8}" y="${m.t - 10}" class="t-cap" text-anchor="end">dB</text>`;
  const path = (arr) => {
    let p = '';
    for (let i = 0; i < arr.length; i++) p += (i ? 'L' : 'M') + X(spec.f[i]).toFixed(1) + ' ' + Y(Math.max(y0, Math.min(y1, arr[i]))).toFixed(1);
    return p;
  };
  // cursors for the speed under the slider
  const F = M.defectFactors();
  const fr = rpm / 60;
  const fam = [];
  for (let h = 1; h <= 4; h++) fam.push({ f: h * F.BPFO * fr, label: h === 1 ? 'BPFO' : h + '×', main: true });
  fam.push({ f: F.FTF * fr, label: 'FTF' }, { f: fr, label: '1×' }, { f: F.BSF * fr, label: 'BSF' }, { f: F.BPFI * fr, label: 'BPFI' });
  for (const c of fam) {
    if (c.f > spec.fmax) continue;
    const x = X(c.f).toFixed(1);
    o += c.main
      ? `<line x1="${x}" x2="${x}" y1="${m.t - 4}" y2="${m.t + ph}" stroke="${ACT}" stroke-width="1.25" class="cursor"/>`
      : `<line x1="${x}" x2="${x}" y1="${m.t - 18}" y2="${m.t + ph}" stroke="${INK3}" stroke-dasharray="3 3" class="cursor"/>`;
    o += `<text x="${x}" y="${c.main ? m.t - 8 : m.t - 22}" class="t-cur${c.main ? ' is-main' : ''}" text-anchor="middle">${c.label}</text>`;
  }
  o += `<path d="${path(spec.base)}" fill="none" stroke="${BASE}" stroke-width="1.1" stroke-linejoin="round"/>`;
  o += `<path d="${path(spec.now)}" fill="none" stroke="${INK}" stroke-width="1.25" stroke-linejoin="round"/>`;
  // annotate the defect peak (measured, so it does not move with the slider)
  const facts = M.spectrumFacts(spec);
  const pi = Math.round(facts.peakHz / spec.df);
  const px = X(facts.peakHz), py = Y(spec.now[pi]);
  const lx = Math.min(px + 46, m.l + pw - 230), ly = Math.max(m.t + 16, py - 20);
  o += `<path d="M${px + 3} ${py - 2}L${lx - 4} ${ly - 4}" stroke="${INK}" fill="none"/>`;
  o += `<rect x="${lx - 2}" y="${ly - 16}" width="226" height="22" fill="#F9FAF6"/>`;
  o += `<text x="${lx + 4}" y="${ly}" class="t-note">${facts.peakHz.toFixed(1)} Hz · ${facts.overBase.toFixed(1)} dB over baseline</text>`;
  o += `<rect class="hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/>`;
  o += `<line class="xhair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" stroke="${INK}" stroke-width="1" visibility="hidden"/>`;
  svg.innerHTML = o;
  svg._scale = { X, m, pw, fam };
}

export function spectrumHover(evt, svg, spec) {
  const s = svg._scale;
  if (!s) return;
  const r = svg.getBoundingClientRect();
  const x = evt.clientX - r.left;
  const f = Math.max(0, Math.min(spec.fmax, ((x - s.m.l) / s.pw) * spec.fmax));
  const i = Math.round(f / spec.df);
  const line = svg.querySelector('.xhair');
  line.setAttribute('x1', s.X(spec.f[i]));
  line.setAttribute('x2', s.X(spec.f[i]));
  line.setAttribute('visibility', 'visible');
  const near = s.fam.reduce((a, c) => (Math.abs(c.f - f) < Math.abs(a.f - f) ? c : a));
  const lines = [`Now ${spec.now[i].toFixed(1)} dB`, `Baseline ${spec.base[i].toFixed(1)} dB`];
  if (Math.abs(near.f - f) < 6) lines.push(`Nearest cursor: ${near.label === 'BPFO' || near.main ? 'BPFO ' + near.label.replace('BPFO', '1×') : near.label} at ${near.f.toFixed(1)} Hz`);
  showTip(evt, `${spec.f[i].toFixed(2)} Hz`, lines);
}
export function spectrumLeave(svg) {
  const l = svg.querySelector('.xhair');
  if (l) l.setAttribute('visibility', 'hidden');
  hideTip();
}

// ----------------------------------------------- wear trend and forecast
export function renderRul(svg, model) {
  const W = svg.parentElement.clientWidth;
  const H = 300;
  const m = { l: 46, r: 64, t: 26, b: 34 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const days = 26, dMin = 0.008, dMax = 1.4;
  const X = (t) => m.l + (t / days) * pw;
  const Y = (d) => m.t + (1 - (Math.log10(d) - Math.log10(dMin)) / (Math.log10(dMax) - Math.log10(dMin))) * ph;
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const L = model.byId.L03, r = model.rul, now = M.N_PAST / 4;
  let o = '';
  for (let t = 0; t <= days; t += 1) o += `<line x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${m.t + ph}" stroke="${GRID}"/>`;
  for (const d of [0.01, 0.02, 0.03, 0.05, 0.1, 0.2, 0.3, 0.5, 1]) {
    const bold = [0.01, 0.1, 1].includes(d);
    o += `<line x1="${m.l}" x2="${m.l + pw}" y1="${Y(d)}" y2="${Y(d)}" stroke="${bold ? GRID_B : GRID}"/>`;
    if ([0.01, 0.03, 0.1, 0.3, 1].includes(d)) o += `<text x="${m.l - 8}" y="${Y(d) + 4}" class="t-num" text-anchor="end">${d}</text>`;
  }
  for (let t = 0.5; t <= days; t += 4) {
    const k = Math.round(t * 4);
    const ms = M.NOW - (M.N_PAST - k) * 6 * 3600e3;
    o += `<text x="${X(t)}" y="${m.t + ph + 18}" class="t-num" text-anchor="middle">${M.ist(ms).day} ${M.monthName(ms)}</text>`;
  }
  // thresholds
  const thr = [[M.WATCH_AT, WATCH, 'watch'], [M.ACT_AT, ACT, 'act'], [1, INK, 'failure level']];
  for (const [d, c, l] of thr) o += `<line x1="${m.l}" x2="${m.l + pw}" y1="${Y(d)}" y2="${Y(d)}" stroke="${c}" stroke-width="${d === 1 ? 1.5 : 1.25}"/><text x="${m.l + pw + 6}" y="${Y(d) + 4}" class="t-cap">${l}</text>`;
  // forecast fan from the Monte Carlo growth-rate spread
  const z = 1.2816;
  const bLo = r.bMed * Math.exp(-z * r.bSigma), bHi = r.bMed * Math.exp(z * r.bSigma);
  // clip to the plot instead of clamping, so the forecast never fakes a plateau
  const cid = 'rul-clip-' + Math.random().toString(36).slice(2, 7);
  o += `<defs><clipPath id="${cid}"><rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/></clipPath></defs>`;
  let up = '', lo = '', mid = '';
  for (let t = now; t <= days + 0.001; t += 0.25) {
    const dt = t - now;
    up += `${X(t).toFixed(1)},${Y(Math.min(50, r.dNow * Math.exp(bHi * dt))).toFixed(1)} `;
    lo = `${X(t).toFixed(1)},${Y(Math.min(50, r.dNow * Math.exp(bLo * dt))).toFixed(1)} ` + lo;
    mid += (mid ? 'L' : 'M') + `${X(t).toFixed(1)} ${Y(Math.min(50, r.dNow * Math.exp(r.bMed * dt))).toFixed(1)}`;
  }
  o += `<g clip-path="url(#${cid})"><polygon points="${up}${lo}" fill="rgba(86,98,108,.16)"/>`;
  o += `<path d="${mid}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="5 4"/></g>`;
  // measured wear, gaps where the loom was off
  let p = '', pen = false;
  for (const c of L.cards) {
    if (c.off) { pen = false; continue; }
    p += (pen ? 'L' : 'M') + `${X(c.t).toFixed(1)} ${Y(c.dS).toFixed(1)}`;
    pen = true;
  }
  o += `<path d="${p}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
  // now, the repair window and the change point
  o += `<line x1="${X(now)}" x2="${X(now)}" y1="${m.t}" y2="${m.t + ph}" stroke="${INK}"/><text x="${X(now) - 4}" y="${m.t - 8}" class="t-cap" text-anchor="end">now</text>`;
  const tr = now + 50 / 24;
  o += `<line x1="${X(tr)}" x2="${X(tr)}" y1="${m.t}" y2="${m.t + ph}" stroke="${INK}" stroke-width="2"/><text x="${X(tr) + 6}" y="${m.t - 8}" class="t-cap">repair · Thu 14:00</text>`;
  if (model.ph) {
    const ta = (model.ph.alarm + 0.5) / 4;
    o += `<line x1="${X(ta)}" x2="${X(ta)}" y1="${m.t}" y2="${m.t + ph}" stroke="${INK3}" stroke-dasharray="2 3"/><text x="${X(ta) + 4}" y="${m.t + 12}" class="t-cap">change detected</text>`;
  }
  // where the fan crosses the failure level
  const yF = Y(1);
  for (const [lab, t] of [['P10', r.p10], ['P50', r.p50], ['P90', r.p90]]) {
    const x = X(now + t);
    if (now + t > days) continue;
    o += `<line x1="${x}" x2="${x}" y1="${yF - 5}" y2="${yF + 5}" stroke="${ACT}" stroke-width="2"/><text x="${x}" y="${yF - 9}" class="t-num" text-anchor="middle">${lab}</text>`;
  }
  o += `<rect class="hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/><line class="xhair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" stroke="${INK}" visibility="hidden"/>`;
  svg.innerHTML = o;
  svg._scale = { X, m, pw, days, now };
}

export function rulHover(evt, svg, model) {
  const s = svg._scale;
  if (!s) return;
  const rect = svg.getBoundingClientRect();
  const t = Math.max(0, Math.min(s.days, ((evt.clientX - rect.left - s.m.l) / s.pw) * s.days));
  const line = svg.querySelector('.xhair');
  line.setAttribute('x1', s.X(t));
  line.setAttribute('x2', s.X(t));
  line.setAttribute('visibility', 'visible');
  const k = Math.floor(t * 4);
  if (t <= s.now) {
    const c = model.byId.L03.cards[Math.min(M.N_PAST - 1, k)];
    return showTip(evt, c.off ? 'Loom off' : `Degradation ${c.dS.toFixed(3)}`, [M.cardLabel(c.k)]);
  }
  const dt = t - s.now, r = model.rul, z = 1.2816;
  const lo = r.dNow * Math.exp(r.bMed * Math.exp(-z * r.bSigma) * dt), hi = r.dNow * Math.exp(r.bMed * Math.exp(z * r.bSigma) * dt);
  showTip(evt, `P(failed by then) ${M.pct(r.cdf(dt))}`, [M.cardLabel(k), `Degradation P10–P90 ${Math.min(lo, 9).toFixed(2)}–${Math.min(hi, 9).toFixed(2)}`]);
}

// --------------------------------------------------- repair-window costs
export function costRows(el, cost, { compact = false } = {}) {
  const max = cost.unplanned;
  el.replaceChildren();
  for (const w of cost.windows) {
    const best = w.id === cost.best.id;
    const row = document.createElement('div');
    row.className = 'win' + (best ? ' is-best' : '');
    const when = document.createElement('div');
    when.className = 'win-when';
    const b = document.createElement('strong');
    b.textContent = w.when;
    const n = document.createElement('span');
    n.textContent = w.note;
    when.append(b, n);
    const risk = document.createElement('div');
    risk.className = 'win-risk mono';
    risk.textContent = w.t === Infinity ? '100%' : M.pct(w.F);
    risk.title = 'Chance it fails before this window';
    const bar = document.createElement('div');
    bar.className = 'win-bar';
    const fillEl = document.createElement('i');
    fillEl.style.width = `${Math.max(1.5, (w.E / max) * 68)}%`;
    const v = document.createElement('b');
    v.className = 'mono';
    v.textContent = M.inr(w.E);
    bar.append(fillEl, v);
    row.append(when, risk, bar);
    el.appendChild(row);
  }
  if (!compact) {
    const head = document.createElement('div');
    head.className = 'win win-head';
    head.innerHTML = '<div>Repair window</div><div class="mono">Fails first</div><div>Expected cost</div>';
    el.prepend(head);
  }
}

// ----------------------------------------------- Bayesian ranking as cells
export function posteriorRows(el, rows, { limit = 8 } = {}) {
  el.replaceChildren();
  rows.slice(0, limit).forEach((h, i) => {
    const li = document.createElement('li');
    li.className = 'post' + (i === 0 ? ' is-top' : '');
    const name = document.createElement('span');
    name.className = 'post-name';
    name.textContent = h.name;
    const cells = document.createElement('span');
    cells.className = 'post-cells';
    cells.setAttribute('aria-hidden', 'true');
    const filled = Math.round(h.p * 20);
    for (let c = 0; c < 20; c++) {
      const s = document.createElement('i');
      if (c < filled) s.className = 'on';
      cells.appendChild(s);
    }
    const p = document.createElement('span');
    p.className = 'post-p mono';
    p.textContent = h.p < 0.001 ? '<0.1%' : (h.p * 100).toFixed(1) + '%';
    const id = document.createElement('span');
    id.className = 'post-id mono';
    id.textContent = h.id;
    li.append(name, cells, p, id);
    el.appendChild(li);
  });
}

// ------------------------------------------------------ the 6205 drawing
// A section through the drive-end bearing, drawn to scale. Balls orbit at the
// cage frequency; each pass over the spall is a pulse on the strip below.
export function bearingView(canvas, strip, getRpm, { reduced }) {
  const ctx = canvas.getContext('2d');
  const sctx = strip.getContext('2d');
  const B = M.BEARING, F = M.defectFactors();
  const SLOW = 40; // shown 40× slower than life
  const pulses = [];
  let last = performance.now(), simT = 0, raf = 0, lastPass = [];
  function size(c) {
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    return { w: r.width, h: r.height, dpr };
  }
  let dims = size(canvas), sdims = size(strip);
  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const fr = getRpm() / 60;
    if (!reduced) simT += dt / SLOW;
    const { w, h, dpr } = dims;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, k = (Math.min(w, h) / 2 - 10) / (B.od / 2 + 3);
    const R = (mm) => mm * k;
    const pitchR = B.D / 2, ballR = B.d / 2;
    // housing section (hatched), outer ring, inner ring, shaft
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R(B.od / 2 + 3), 0, Math.PI * 2); ctx.arc(cx, cy, R(B.od / 2), 0, Math.PI * 2, true); ctx.clip('evenodd');
    ctx.strokeStyle = 'rgba(23,25,28,.35)'; ctx.lineWidth = 1;
    for (let x = -w; x < w * 2; x += 5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = INK;
    const ring = (r) => { ctx.beginPath(); ctx.arc(cx, cy, R(r), 0, Math.PI * 2); ctx.stroke(); };
    ring(B.od / 2); ring(pitchR + ballR); ring(pitchR - ballR); ring(B.bore / 2);
    ctx.fillStyle = '#E2E6DD';
    ctx.beginPath(); ctx.arc(cx, cy, R(B.bore / 2), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // shaft key mark turns at shaft speed
    const th = 2 * Math.PI * fr * simT;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(th) * R(B.bore / 2), cy + Math.sin(th) * R(B.bore / 2)); ctx.stroke();
    // the spall in the load zone, bottom of the outer race
    const sp = Math.PI / 2;
    ctx.fillStyle = ACT;
    ctx.beginPath(); ctx.arc(cx, cy, R(pitchR + ballR + 0.9), sp - 0.07, sp + 0.07); ctx.arc(cx, cy, R(pitchR + ballR - 0.2), sp + 0.07, sp - 0.07, true); ctx.closePath(); ctx.fill();
    // cage and balls
    const cage = 2 * Math.PI * F.FTF * fr * simT;
    ctx.setLineDash([2, 3]); ring(pitchR); ctx.setLineDash([]);
    for (let i = 0; i < B.n; i++) {
      const a = cage + (2 * Math.PI * i) / B.n;
      const bx = cx + Math.cos(a) * R(pitchR), by = cy + Math.sin(a) * R(pitchR);
      ctx.fillStyle = '#F9FAF6';
      ctx.beginPath(); ctx.arc(bx, by, R(ballR), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const spin = -2 * Math.PI * F.BSF * fr * simT + a;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(spin) * R(ballR), by + Math.sin(spin) * R(ballR)); ctx.stroke();
      // detect a pass over the spall
      const rel = ((((a - sp) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      if (lastPass[i] !== undefined && lastPass[i] < 0 && rel >= 0 && !reduced) pulses.push(simT);
      lastPass[i] = rel;
    }
    drawStrip(fr);
    raf = requestAnimationFrame(draw);
  }
  function drawStrip(fr) {
    const { w, h, dpr } = sdims;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, w, h);
    const span = 3 / SLOW; // last 3 s of screen time
    sctx.strokeStyle = 'rgba(64,108,98,.26)';
    sctx.lineWidth = 1;
    sctx.beginPath(); sctx.moveTo(0, h - 0.5); sctx.lineTo(w, h - 0.5); sctx.stroke();
    if (reduced) {
      const per = 1 / (F.BPFO * fr);
      for (let t = 0; t < span; t += per) { const x = (t / span) * w; sctx.fillStyle = INK; sctx.fillRect(x, 4, 1.5, h - 8); }
      return;
    }
    while (pulses.length && pulses[0] < simT - span) pulses.shift();
    sctx.fillStyle = INK;
    for (const t of pulses) { const x = w - ((simT - t) / span) * w; sctx.fillRect(x, 4, 1.5, h - 8); }
  }
  const ro = new ResizeObserver(() => { dims = size(canvas); sdims = size(strip); });
  ro.observe(canvas);
  ro.observe(strip);
  return {
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}

// ------------------------------------------------------------ waveform
export function drawWave(canvas, buf) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, r.width, r.height);
  const data = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / r.width));
  c.fillStyle = INK;
  for (let x = 0; x < r.width; x++) {
    let lo = 1, hi = -1;
    for (let i = x * step; i < (x + 1) * step && i < data.length; i++) { const v = data[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    const y0 = (0.5 - hi * 0.48) * r.height, y1 = (0.5 - lo * 0.48) * r.height;
    c.fillRect(x, y0, 1, Math.max(1, y1 - y0));
  }
}
