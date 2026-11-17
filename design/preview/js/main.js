// NAADI design preview: wiring. Two views (shed floor, Loom 03 case file),
// one state object, stepped motion, owner approval as the only outward action.
import * as M from './model.js';
import * as C from './charts.js';
import * as A from './audio.js';
import { ICON } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVGNS = 'http://www.w3.org/2000/svg';

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
function stIcon(st) {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('class', 'ico st');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVGNS, 'use');
  u.setAttribute('href', '#i-' + st);
  s.append(u);
  return s;
}
const icon = (name) => h('span', { class: 'ico-slot', html: ICON[name] });
for (const el of $$('[data-icon]')) el.innerHTML = ICON[el.dataset.icon] || '';

// ------------------------------------------------------------ the model
const model = M.buildModel();
const spec = M.envelopeSpectrum();
const facts = M.spectrumFacts(spec);
const EV = ['env', 'kurt', 'note', 'temp', 'bpfi', 'x1'];
const evidence = M.evidence(spec);
const post = M.posterior(EV);
const postNoNote = M.posterior(EV.filter((e) => e !== 'note'));
const measuredRpm = Math.round(M.speedFrom1x(spec));
const L03 = model.byId.L03;
const { cost, rul, fit, ph } = model;
const sun = cost.windows.find((w) => w.id === 'sun');
const S = { index: M.N_PAST - 1, selected: 'L03', approved: false, snoozed: false, rpm: measuredRpm, lang: 'en' };
let shed = null;

// ------------------------------------------------------------ language
// Hindi and Marathi strings are machine-drafted and need a native speaker's review.
const T = {
  en: {
    'nav.floor': 'Shed floor', 'nav.case': 'Loom 03 case file', demo: 'Demo data', offline: 'Works offline · synced 12 s ago',
    'h.cards': 'Every machine, card by card', 'h.cards.sub': 'One card per 6 hours. A hole marks a signal that left its learned normal.',
    'h.decision': 'Next decision', 'h.why': 'Why NAADI thinks so', 'h.watch': 'Also watching',
    'st.act': 'Act', 'st.watch': 'Watch', 'st.normal': 'Normal', 'st.off': 'Off',
    'btn.approve': 'Approve repair', 'btn.snooze': 'Not now',
    'dec.fine': "Approving drafts a WhatsApp to the bearing dealer and holds the technician's Thursday. Nothing is sent until you confirm.",
    'link.case': 'Open the case file', replay: 'Replay the fortnight', stop: 'Stop replay',
    dec: ['Repair Loom 03 on ', 'Thursday 19 Nov, 14:00–18:00', ', during the scheduled power cut.'],
    cost: ['Expected cost ', 0, ' instead of ', 1, ' if it runs to failure.'],
  },
  hi: {
    'nav.floor': 'शेड', 'nav.case': 'लूम 03 की केस फ़ाइल', demo: 'डेमो डेटा', offline: 'ऑफ़लाइन भी चलता है · 12 सेकंड पहले सिंक',
    'h.cards': 'हर मशीन, कार्ड-दर-कार्ड', 'h.cards.sub': 'हर 6 घंटे पर एक कार्ड। छेद का मतलब: कोई सिग्नल अपनी सामान्य सीमा से बाहर गया।',
    'h.decision': 'अगला फ़ैसला', 'h.why': 'NAADI ऐसा क्यों मानता है', 'h.watch': 'इन पर भी नज़र',
    'st.act': 'तुरंत कार्रवाई', 'st.watch': 'नज़र रखें', 'st.normal': 'सामान्य', 'st.off': 'बंद',
    'btn.approve': 'मरम्मत मंज़ूर करें', 'btn.snooze': 'अभी नहीं',
    'dec.fine': 'मंज़ूरी देने पर बेयरिंग डीलर के लिए WhatsApp का मसौदा बनेगा और मिस्त्री का गुरुवार रोका जाएगा। आपकी पुष्टि के बिना कुछ नहीं भेजा जाएगा।',
    'link.case': 'केस फ़ाइल खोलें', replay: 'पिछले 14 दिन दोबारा देखें', stop: 'रोकें',
    dec: ['लूम 03 की मरम्मत ', 'गुरुवार 19 नवंबर, 14:00–18:00', ' को, तय बिजली कटौती के दौरान करें।'],
    cost: ['अनुमानित ख़र्च ', 0, '; ख़राब होने तक चलाने पर ', 1, '।'],
  },
  mr: {
    'nav.floor': 'शेड', 'nav.case': 'लूम 03 ची केस फाइल', demo: 'डेमो डेटा', offline: 'ऑफलाइनही चालते · 12 सेकंदांपूर्वी सिंक',
    'h.cards': 'प्रत्येक मशीन, कार्ड-दर-कार्ड', 'h.cards.sub': 'दर 6 तासांनी एक कार्ड. छिद्र म्हणजे एखादा सिग्नल त्याच्या नेहमीच्या पातळीबाहेर गेला.',
    'h.decision': 'पुढचा निर्णय', 'h.why': 'NAADI असे का म्हणते', 'h.watch': 'यांच्यावरही लक्ष',
    'st.act': 'त्वरित कारवाई', 'st.watch': 'लक्ष ठेवा', 'st.normal': 'सामान्य', 'st.off': 'बंद',
    'btn.approve': 'दुरुस्ती मंजूर करा', 'btn.snooze': 'आत्ता नाही',
    'dec.fine': 'मंजुरी दिल्यावर बेअरिंग डीलरसाठी WhatsApp मसुदा तयार होईल आणि मेकॅनिकचा गुरुवार राखून ठेवला जाईल. तुमच्या पुष्टीशिवाय काहीही पाठवले जाणार नाही.',
    'link.case': 'केस फाइल उघडा', replay: 'मागील 14 दिवस पुन्हा पाहा', stop: 'थांबवा',
    dec: ['लूम 03 ची दुरुस्ती ', 'गुरुवार 19 नोव्हेंबर, 14:00–18:00', ' या नियोजित वीजकपातीच्या वेळेत करा.'],
    cost: ['अपेक्षित खर्च ', 0, '; बंद पडेपर्यंत चालवल्यास ', 1, '.'],
  },
};
const t = (k) => T[S.lang][k] ?? T.en[k];
const stLabel = (st) => t('st.' + st);

function renderDecisionText() {
  const d = $('#decision-text');
  const [a, b, c] = cost.best.id === 'thu' ? t('dec') : ['Repair Loom 03: ', cost.best.when, '.'];
  d.replaceChildren(a, h('strong', {}, b), c);
  const nums = [M.inr(cost.best.E), M.inr(cost.unplanned)];
  $('#decision-cost').replaceChildren(...t('cost').map((p) => (typeof p === 'number' ? h('strong', {}, nums[p]) : p)));
}
function applyLang() {
  document.documentElement.lang = S.lang;
  for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
  renderDecisionText();
  updateReplayLabel();
  renderReadout();
  renderWatchlist();
}
$$('.lang button').forEach((b) => b.addEventListener('click', () => { S.lang = b.dataset.lang; applyLang(); }));

// ------------------------------------------------------------ decision panel
function evidenceList(el, ids) {
  el.replaceChildren();
  const OR = M.HYPOTHESES[0];
  for (const e of evidence.filter((x) => ids.includes(x.id))) {
    const lr = e.id === 'bpfi' ? '×0.2 for inner race' : e.id === 'x1' ? '×0.2 for unbalance' : `×${OR.lr[e.id].toFixed(1)}`;
    el.append(h('li', {}, h('span', {}, e.text), h('span', { class: 'lr mono' }, lr), h('span', { class: 'rule mono' }, e.rule)));
  }
}
function renderWatchlist() {
  const el = $('#watchlist');
  el.replaceChildren();
  for (const id of ['P02', 'L05']) {
    const m = model.byId[id];
    el.append(h('li', {},
      stIcon(m.now.state),
      h('button', { type: 'button', onclick: () => select(id) }, `${m.name} · ${stLabel(m.now.state)}`),
      h('p', {}, `${m.prof.label}, ${Math.round(m.prof.p * 100)}% · ${m.prof.rule}`),
      h('p', {}, m.prof.action)));
  }
}
function renderOutcome() {
  for (const box of $$('[data-outcome]')) {
    const scope = box.parentElement;
    const acts = scope.querySelector('[data-actions]');
    const fine = scope.querySelector('[data-fine]');
    box.replaceChildren();
    const open = S.approved || S.snoozed;
    box.hidden = !open;
    if (acts) acts.hidden = open;
    if (fine) fine.hidden = open;
    if (!open) continue;
    box.classList.remove('step-in');
    void box.offsetWidth;
    box.classList.add('step-in');
    if (S.approved) {
      box.append(
        h('p', { class: 'done' }, icon('check'), 'Repair approved at 12:04. Two drafts wait on your phone.'),
        h('div', { class: 'draft' },
          h('div', { class: 'draft-head' }, icon('message'), 'WhatsApp to Laxmi Bearing House', h('span', {}, 'Draft')),
          h('p', {}, '“Namaskar. Need 2 × 6205-2RS bearings by Thursday 12:00 for Shed 2, Ichalkaranji. Please confirm stock and rate.”')),
        h('div', { class: 'draft' },
          h('div', { class: 'draft-head' }, icon('person'), 'Ramesh Patil, technician', h('span', {}, 'Held')),
          h('p', {}, 'Thursday 13:30–18:00 held for Loom 03. Confirm on your phone to book.')),
        h('button', { type: 'button', class: 'btn-quiet', onclick: () => { S.approved = false; afterDecision(); } }, 'Undo approval'));
    } else {
      box.append(
        h('p', {}, `Snoozed. NAADI checks again at the next card, 18:00 today. Waiting until Sunday raises the chance it fails first to ${M.pct(sun.F)}.`),
        h('button', { type: 'button', class: 'btn-quiet', onclick: () => { S.snoozed = false; afterDecision(); } }, 'Undo'));
    }
  }
}
function afterDecision() {
  renderOutcome();
  renderDD();
  if (caseReady) { C.renderChain($('#chain'), model, { approved: S.approved }); renderTrace(); }
}
$$('[data-approve]').forEach((b) => b.addEventListener('click', () => { S.approved = true; S.snoozed = false; afterDecision(); }));
$$('[data-snooze]').forEach((b) => b.addEventListener('click', () => { S.snoozed = true; S.approved = false; afterDecision(); }));

// ------------------------------------------------------------ card record
const dd = $('#drawdown');
const ddLabels = $('#dd-labels');
let ddScrolled = false;
function renderDD() {
  const focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.dd-label') : null;
  const keep = focused ? focused.dataset.m : null;
  const lay = C.renderDrawdown(ddLabels, dd, model, { index: S.index, selected: S.selected, approved: S.approved, labelText: stLabel });
  if (keep) { const n = ddLabels.querySelector(`.dd-label[data-m="${keep}"]`); if (n) n.focus(); }
  const sc = $('#dd-scroll');
  if (!ddScrolled && sc.clientWidth && sc.scrollWidth > sc.clientWidth + 4) {
    // keep "now" in view on narrow screens: the last days punched and the first days ahead
    sc.scrollLeft = Math.max(0, lay.xs[M.N_PAST] - sc.clientWidth * 0.55);
    ddScrolled = true;
  }
}
dd.addEventListener('pointermove', (e) => C.drawdownTip(e, model, S.index));
dd.addEventListener('pointerleave', C.hideTip);
for (const el of [dd, ddLabels]) el.addEventListener('click', (e) => { const n = e.target.closest('[data-m]'); if (n) select(n.dataset.m); });
ddLabels.addEventListener('keydown', (e) => {
  const n = e.target.closest('.dd-label');
  if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(n.dataset.m); }
});

function buildDDTable() {
  const wrap = $('#dd-table');
  const rows = model.machines.map((m) => {
    const recent = m.cards.slice(-4).flatMap((c) => M.CHANNELS.filter((_, i) => c.holes[i]).map((ch) => ch.short));
    const uniq = [...new Set(recent)];
    const note = m.prof ? `${m.prof.label}` : 'Inside its normal';
    return h('tr', {},
      h('td', {}, m.name), h('td', {}, stLabel(m.now.state)),
      h('td', {}, uniq.length ? uniq.join(', ') : 'None'),
      h('td', { class: 'num' }, m.now.dS.toFixed(3)), h('td', {}, note));
  });
  wrap.replaceChildren(h('table', {},
    h('caption', { class: 'sr-only' }, 'Machine state at card 56'),
    h('thead', {}, h('tr', {}, h('th', {}, 'Machine'), h('th', {}, 'Now'), h('th', {}, 'Holes, last 4 cards'), h('th', { class: 'num' }, 'Degradation'), h('th', {}, 'Reading'))),
    h('tbody', {}, rows)));
}
$$('[data-table-toggle]').forEach((b) => b.addEventListener('click', () => {
  const el = document.getElementById(b.dataset.tableToggle);
  if (el.id === 'dd-table' && !el.firstChild) buildDDTable();
  el.hidden = !el.hidden;
  b.setAttribute('aria-expanded', String(!el.hidden));
}));

// ------------------------------------------------------------ selection
// A hole is "isolated" when its channel was clean on the previous three scored cards:
// that is the 1% false-hole rate at work, and the copy says so instead of hiding it.
function splitHoles(m, k) {
  const prev = m.cards.slice(0, k).filter((x) => !x.off).slice(-3);
  const c = m.cards[k];
  const steady = [], isolated = [];
  M.CHANNELS.forEach((ch, i) => {
    if (!c.holes[i]) return;
    (prev.some((p) => p.holes[i]) ? steady : isolated).push(ch.short);
  });
  return { steady, isolated };
}
function renderReadout() {
  const el = $('#readout');
  const m = model.byId[S.selected];
  if (!m) { el.replaceChildren(); return; }
  const c = m.cards[S.index];
  const st = c.off ? 'off' : c.state;
  const { steady, isolated } = splitHoles(m, c.k);
  const names = steady.length ? steady : isolated;
  const holeCount = m.cards.slice(0, S.index + 1).reduce((s, x) => s + x.n, 0);
  const lines = [
    h('div', { class: 'ro-head' }, stIcon(st), m.name, h('span', {}, `· ${stLabel(st)}`)),
    h('p', {}, `Card ${c.k + 1} of 56 · ${M.cardLabel(c.k)}`),
    h('p', {}, c.off ? M.offReason(c.k) : names.length
      ? h('span', {}, 'Holes in ', h('b', {}, names.join(', ')), steady.length && isolated.length ? ` · isolated: ${isolated.join(', ')}` : '')
      : 'No holes: every channel inside its normal'),
  ];
  if (m.id === 'L03') lines.push(h('p', {}, 'Most likely ', h('b', {}, post[0].name.toLowerCase()), `, ${(post[0].p * 100).toFixed(1)}% · ${post[0].id}`));
  else if (m.prof) lines.push(h('p', {}, 'Most likely ', h('b', {}, m.prof.label.toLowerCase()), `, ${Math.round(m.prof.p * 100)}% · ${m.prof.rule}`));
  else lines.push(h('p', {}, holeCount ? `${holeCount} isolated hole${holeCount > 1 ? 's' : ''} so far, about what a 1% false-hole rate predicts.` : 'No holes so far this fortnight.'));
  lines.push(h('p', {}, `Degradation index `, h('b', { class: 'mono' }, c.dS.toFixed(3)), ` · watch at ${M.WATCH_AT}, act at ${M.ACT_AT}`));
  if (m.id === 'L03') lines.push(h('a', { class: 'link', href: '#case' }, t('link.case'), icon('right')));
  el.replaceChildren(...lines);
}
function select(id, { focus = true } = {}) {
  S.selected = id;
  renderDD();
  renderReadout();
  if (shed) shed.select(id, { focus });
}
function hover(id) {
  const tag = $('#tag');
  if (!id || !shed) { tag.hidden = true; return; }
  const p = shed.screenOf(id);
  const m = model.byId[id];
  const c = m.cards[S.index];
  const st = c.off ? 'off' : c.state;
  tag.replaceChildren(stIcon(st), m.name, h('span', {}, `${stLabel(st)} · ${c.off ? 'machine off' : c.n + (c.n === 1 ? ' hole' : ' holes')}`));
  tag.style.left = p.x + 'px';
  tag.style.top = p.y + 'px';
  tag.hidden = false;
}
$$('[data-cam]').forEach((b) => b.addEventListener('click', () => {
  $$('[data-cam]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  if (shed) shed.view(b.dataset.cam);
}));

// ------------------------------------------------------------ time scrub
const range = $('#card-index');
let timer = 0;
// The scrub track is data: each of the 56 card slots carries the shed's worst state that card,
// laid so each slot centre sits under the thumb at that value.
const RANK = { off: 0, normal: 1, watch: 2, act: 3 };
const worst = Array.from({ length: M.N_PAST }, (_, k) =>
  model.machines.reduce((w, m) => { const c = m.cards[k]; const s = c.off ? 'off' : c.state; return RANK[s] > RANK[w] ? s : w; }, 'off'));
function renderStrip() {
  const svg = $('#scrub-strip');
  const W = svg.parentElement.clientWidth;
  if (!W) return;
  const step = (W - 8) / (M.N_PAST - 1), w = Math.max(1, step - 2);
  const fillOf = { off: 'url(#strip-hatch)', normal: '#E2E6DD', watch: 'var(--watch)', act: 'var(--act)' };
  let o = '<defs><pattern id="strip-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#E9ECE4"/><path d="M0 0v4" stroke="#9BA19A" stroke-width="1.1"/></pattern></defs>';
  for (let k = 0; k < M.N_PAST; k++) {
    o += `<rect x="${(4 + k * step - w / 2).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="16" fill="${fillOf[worst[k]]}"${k > S.index ? ' opacity=".3"' : ''}/>`;
  }
  svg.setAttribute('viewBox', `0 0 ${W} 16`);
  svg.innerHTML = o;
}
function setIndex(k) {
  S.index = k;
  range.value = k;
  $('#card-out').textContent = `Card ${k + 1} of 56 · ${M.cardLabel(k)}`;
  const past = k < M.N_PAST - 1;
  $('#decision').classList.toggle('is-past', past);
  const note = $('#past-note');
  note.hidden = !past;
  if (past) note.textContent = `Replaying card ${k + 1}. The decision below is for card 56, now.`;
  renderDD();
  renderReadout();
  renderStrip();
  if (shed) shed.setIndex(k);
}
range.addEventListener('input', () => setIndex(Number(range.value)));
function updateReplayLabel() {
  const b = $('#replay');
  b.querySelector('[data-icon]').innerHTML = ICON[timer ? 'pause' : 'play'];
  b.querySelector('[data-i18n]').textContent = t(timer ? 'stop' : 'replay');
}
function stopReplay() { clearInterval(timer); timer = 0; updateReplayLabel(); }
$('#replay').addEventListener('click', () => {
  if (timer) return stopReplay();
  let k = S.index >= M.N_PAST - 1 ? 0 : S.index;
  setIndex(k);
  timer = setInterval(() => {
    k += 1;
    setIndex(k);
    if (k >= M.N_PAST - 1) stopReplay();
  }, reduced ? 30 : 115);
  updateReplayLabel();
});

// ------------------------------------------------------------ the shed
async function initShed() {
  const host = $('#shed');
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 120px "Anek Latin"'), document.fonts.load('600 40px "Anek Latin"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
    const { createShed } = await import('./shed.js');
    shed = createShed(host, { model, reducedMotion: reduced, onSelect: (id) => select(id), onHover: hover });
    shed.setIndex(S.index);
    shed.select(S.selected, { focus: false });
    if (new URLSearchParams(location.search).has('debug')) window.__naadi = { shed };
  } catch (err) {
    console.error('3D shed unavailable:', err);
    $('.shed-fallback').hidden = false;
  } finally {
    $('#shed-loading').hidden = true;
  }
}

// ------------------------------------------------------------ case file
let caseReady = false;
let bearing = null;
const bufs = {};
function updateSpeed() {
  const fr = S.rpm / 60;
  $('#rpm-out').textContent = `${S.rpm.toLocaleString('en-IN')} rpm · ${fr.toFixed(2)} Hz${S.rpm === measuredRpm ? ' · measured' : ''}`;
  C.renderSpectrum($('#spectrum'), spec, { rpm: S.rpm });
  const f = M.cursorFit(spec, S.rpm);
  $('#fit').replaceChildren(f > 8
    ? h('span', {}, 'At these cursors the BPFO family stands ', h('b', {}, `${f.toFixed(1)} dB`), ' above the local floor: the peaks sit exactly on the outer-race tones.')
    : h('span', {}, 'Only ', h('b', {}, `${f.toFixed(1)} dB`), ` at these cursors: at ${S.rpm.toLocaleString('en-IN')} rpm the outer-race tones miss the measured peaks. Speed has to be right before the physics can speak.`));
  const F = M.defectFactors();
  const row = (dt, dd, main) => [h('dt', { class: main ? 'is-main' : '' }, dt), h('dd', { class: main ? 'is-main' : '' }, ...dd)];
  $('#freqs').replaceChildren(
    ...row('Shaft', [`${S.rpm} rpm ÷ 60 = ${fr.toFixed(2)} Hz`]),
    ...row('FTF', [`${F.FTF.toFixed(3)} × fr = ${(F.FTF * fr).toFixed(2)} Hz`]),
    ...row('BSF', [`${F.BSF.toFixed(3)} × fr = ${(F.BSF * fr).toFixed(1)} Hz`]),
    ...row('BPFO', [`${F.BPFO.toFixed(3)} × fr = `, h('b', {}, `${(F.BPFO * fr).toFixed(1)} Hz`)], true),
    ...row('BPFI', [`${F.BPFI.toFixed(3)} × fr = ${(F.BPFI * fr).toFixed(1)} Hz`]),
    ...row('Geometry', [`n = ${M.BEARING.n} balls, d/D = ${F.ratio.toFixed(3)}, BPFO = (n/2)(1 − d/D)·fr`]),
  );
  const tones = M.toneTable(spec, S.rpm);
  $('#peak-table').replaceChildren(h('table', {},
    h('caption', { class: 'sr-only' }, 'Bearing tones at the selected speed'),
    h('thead', {}, h('tr', {}, h('th', {}, 'Tone'), h('th', { class: 'num' }, 'Hz'), h('th', { class: 'num' }, 'Now, dB over floor'), h('th', { class: 'num' }, 'Baseline, dB over floor'))),
    h('tbody', {}, tones.map((r) => h('tr', {}, h('td', {}, r.name), h('td', { class: 'num' }, r.hz.toFixed(1)), h('td', { class: 'num' }, r.now.toFixed(1)), h('td', { class: 'num' }, r.base.toFixed(1)))))));
}
function renderTrace() {
  const c = L03.cards[M.N_PAST - 1];
  const { steady, isolated } = splitHoles(L03, c.k);
  const lc = (a) => a.map((s) => s.toLowerCase()).join(', ');
  const iso = isolated.length ? ` One isolated hole in ${lc(isolated)}, within the 1% false-hole rate, so it carries no weight.` : '';
  const best = cost.best;
  const items = [
    ['09:41:02', 'Sentinel', 'scoreCard(56, regime = "full load")', `Holes punched in ${lc(steady)}.${iso} Degradation ${c.dS.toFixed(3)} against an act level of ${M.ACT_AT}.`],
    ['09:41:03', 'Diagnostician', `envelopePeaks(fr = ${(measuredRpm / 60).toFixed(2)} Hz)`, `BPFO ${facts.peakHz.toFixed(1)} Hz at ${facts.overBase.toFixed(1)} dB over baseline; 2× and 3× present; nothing at BPFI.`],
    ['09:41:03', 'Diagnostician', 'queryRulebook("BRG-*", "UNB-*", "ALN-*")', 'BRG-OR-01 evidence e1, e2 and e4 matched; the BPFI gap and an unchanged 1× argue against BRG-IR-01 and UNB-01.'],
    ['09:42:40', 'Worker note', 'transcribe(voice, lang = "mr")', 'Sunita K.: “खट-खट आवाज येतोय” → BRG-OR-01 e3, likelihood ratio 1.8.'],
    ['09:42:41', 'Diagnostician', 'bayesRank(8 hypotheses, 6 evidence)', `Outer-race defect ${(post[0].p * 100).toFixed(1)}%, up from ${(postNoNote[0].p * 100).toFixed(1)}% before the note.`],
    ['09:42:42', 'Prognostician', `fitGrowth(cards ${ph.onset + 1}–56) · monteCarlo(n = ${rul.n.toLocaleString('en-IN')})`, `b = ${fit.b.toFixed(3)} per day. Time to failure P10 ${rul.p10.toFixed(1)} d, P50 ${rul.p50.toFixed(1)} d, P90 ${rul.p90.toFixed(1)} d; ${M.pct(rul.cdf(7))} within 7 days.`],
    ['09:42:43', 'Planner', 'optimiseRepairWindow(4 windows)', `${best.when}, ${best.note.toLowerCase()}: ${M.inr(best.E)} expected against ${M.inr(cost.unplanned)} for a breakdown.`],
    ['09:42:44', 'Procurement', 'draftWhatsApp(dealer, "6205-2RS × 2")', S.approved ? 'Draft is on the owner’s phone, ready to send.' : 'Draft prepared. Waiting for the owner.', !S.approved],
    ['09:42:44', 'Dispatcher', 'holdSlot(technician, "Thu 13:30–18:00")', S.approved ? 'Held for Loom 03.' : 'Tentative hold. Waiting for the owner.', !S.approved],
  ];
  if (S.approved) items.push(['12:04:10', 'Owner', 'approve(repair, "Thu 19 Nov 14:00")', 'Approved. Messages leave only when the owner taps send.', false, true]);
  $('#trace').replaceChildren(...items.map(([when, who, call, res, wait, fresh]) =>
    h('li', { class: (wait ? 'is-wait' : '') + (fresh ? ' is-new step-in' : '') },
      h('span', { class: 'when' }, when), h('span', { class: 'who' }, who),
      h('span', {}, h('code', {}, call), h('span', { class: 'res' }, res)))));
}
function buildCase() {
  caseReady = true;
  $('#case-summary').textContent = `${post[0].name}, ${(post[0].p * 100).toFixed(1)}% · fails within 7 days: ${M.pct(rul.cdf(7))} · repairing Thursday saves ${M.inr(cost.saving)}`;
  const rpm = $('#rpm');
  rpm.value = S.rpm;
  rpm.addEventListener('input', () => { S.rpm = Number(rpm.value); updateSpeed(); });
  $('#snap').addEventListener('click', () => { S.rpm = measuredRpm; rpm.value = S.rpm; updateSpeed(); });
  const sp = $('#spectrum');
  sp.addEventListener('pointermove', (e) => C.spectrumHover(e, sp, spec));
  sp.addEventListener('pointerleave', () => C.spectrumLeave(sp));
  const ru = $('#rul');
  ru.addEventListener('pointermove', (e) => C.rulHover(e, ru, model));
  ru.addEventListener('pointerleave', () => C.spectrumLeave(ru));
  const ch = $('#chain');
  ch.addEventListener('pointermove', (e) => C.chainTip(e, model));
  ch.addEventListener('pointerleave', C.hideTip);
  C.posteriorRows($('#post-case'), post);
  evidenceList($('#ev-case'), EV);
  $('#note-shift').textContent = `Without it the outer-race posterior was ${(postNoNote[0].p * 100).toFixed(1)}%; with it, ${(post[0].p * 100).toFixed(1)}%.`;
  C.costRows($('#windows-case'), cost);
  $('#formula').textContent = `E[cost of window t] = F(t) × ${M.inr(cost.unplanned)} + (1 − F(t)) × (${M.inr(cost.planned)} + lost output), with F(t) from ${rul.n.toLocaleString('en-IN')} Monte Carlo runs.`;
  const P = cost.parts, K = M.COST;
  const tr = (a, b, cls) => h('tr', { class: cls || '' }, h('td', {}, a), h('td', { class: 'num' }, b));
  $('#breakdown').replaceChildren(h('tbody', {},
    tr(`Lost output: ${K.downtimeH} h × ${M.inr(cost.perH)}/h (margin ${M.inr(K.marginH)} + idle wages ${M.inr(K.wagesH)})`, M.inr(P.downtime)),
    tr(`Rush part: 6205-2RS at ${M.inr(K.part)} + ${K.premium * 100}%`, M.inr(P.part)),
    tr('Emergency call-out', M.inr(P.callout)),
    tr(`Secondary damage: ${K.pSecondary * 100}% × ${M.inr(K.secondary)} (shaft, housing)`, M.inr(P.secondary)),
    tr('Breakdown bill', M.inr(cost.unplanned), 'total'),
    tr(`Planned bill: part ${M.inr(K.part)} + labour ${M.inr(K.labour)}`, M.inr(cost.planned))));
  $('#rul-note').textContent = `Growth rate fitted by least squares on ${fit.n} cards since the change point: b = ${fit.b.toFixed(3)} ± ${fit.se.toFixed(3)} per day. The fan adds a ±25% prior on how wear accelerates; the app will calibrate it on NASA IMS run-to-failure data.`;
  renderTrace();
  bearing = C.bearingView($('#bearing'), $('#pulse'), () => S.rpm, { reduced });
  for (const b of $$('[data-sound]')) {
    b.addEventListener('click', async () => {
      const kind = b.dataset.sound;
      if (b.getAttribute('aria-pressed') === 'true') { A.stop(); return; }
      bufs[kind] = bufs[kind] || A.prepare(kind);
      C.drawWave($('#wave'), bufs[kind]);
      $$('[data-sound]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      await A.play(bufs[kind], () => b.setAttribute('aria-pressed', 'false'));
    });
  }
}
function renderCaseCharts() {
  updateSpeed();
  C.renderChain($('#chain'), model, { approved: S.approved });
  C.renderRul($('#rul'), model);
  bufs.now = bufs.now || A.prepare('now');
  C.drawWave($('#wave'), bufs.now);
}

// ------------------------------------------------------------ routing
function route() {
  const v = location.hash === '#case' ? 'case' : 'floor';
  $('#view-floor').hidden = v !== 'floor';
  $('#view-case').hidden = v !== 'case';
  $$('.tabs a').forEach((a) => (a.dataset.view === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.title = v === 'case' ? 'NAADI · Loom 03 case file (design preview)' : 'NAADI · Shed 2 (design preview)';
  C.hideTip();
  if (v === 'case') {
    if (!caseReady) buildCase();
    renderCaseCharts();
    if (bearing) bearing.start();
  } else {
    if (bearing) bearing.stop();
    A.stop();
    renderDD();
  }
  window.scrollTo(0, 0);
}
addEventListener('hashchange', route);

// re-draw charts when their containers change width (directly, not via
// requestAnimationFrame, so a background tab still re-flows correctly)
const widths = new WeakMap();
const ro = new ResizeObserver((entries) => {
  let changed = false;
  for (const e of entries) {
    const w = Math.round(e.contentRect.width);
    if (widths.get(e.target) !== w) { widths.set(e.target, w); changed = true; }
  }
  if (!changed) return;
  if (!$('#view-floor').hidden) { renderDD(); renderStrip(); }
  if (caseReady && !$('#view-case').hidden) {
    C.renderSpectrum($('#spectrum'), spec, { rpm: S.rpm });
    C.renderChain($('#chain'), model, { approved: S.approved });
    C.renderRul($('#rul'), model);
  }
});
[$('#dd-scroll'), $('.scrub-track'), $('.spec .chart'), $('.chain .scroll-x'), $('.rul .chart')].forEach((el) => el && ro.observe(el));

// ------------------------------------------------------------ boot
C.costRows($('#windows-floor'), cost, { compact: true });
C.posteriorRows($('#post-floor'), post, { limit: 3 });
evidenceList($('#ev-floor'), ['env', 'kurt', 'note']);
applyLang();
setIndex(S.index);
route();
initShed();
