// The facts behind the owner's note, built from the agent run. The narrator route sends
// exactly these to the language model; the template writes the same note from them; and the
// checker refuses any phrasing that carries a number these facts do not contain.
import { inr, pct, type Lang } from '@/lib/model/core';
import type { NaadiModel } from '@/lib/model';
import { planRun, type RunInput } from './pipeline';

export interface NarrateInput extends RunInput { lang: Lang }

export interface OwnerFacts {
  machine: string;
  likelyCause: string;
  probability: string;
  rule: string;
  evidence: string[];
  timeToFailure: string;
  recommendedWindow: string;
  windowNote: string;
  chanceOfFailingFirst: string;
  expectedCost: string;
  breakdownBill: string;
  part: string;
  drafts: string;
  ownerDecision: string;
}

const DECISION: Record<RunInput['decision'], string> = {
  open: 'Waiting for the owner. Nothing has been sent; the drafts are held until the owner approves.',
  approved: 'The owner approved the repair. The drafts are on the owner’s phone, ready to send; nothing leaves until the owner taps send.',
  snoozed: 'The owner chose not now. The drafts stay held and the risk of waiting is stated above.',
};

export function ownerFacts(model: NaadiModel, input: RunInput): OwnerFacts {
  const run = planRun(model, input);
  const best = run.cost.best, r = model.loom.rul!;
  const ids = input.useNote ? ['env', 'kurt', 'note', 'temp'] : ['env', 'kurt', 'temp'];
  return {
    machine: 'Loom 03, motor drive-end bearing 6205-2RS',
    likelyCause: run.post[0].name.toLowerCase(),
    probability: (run.post[0].p * 100).toFixed(1) + '%',
    rule: run.post[0].id,
    evidence: model.evidence.filter((e) => ids.includes(e.id)).map((e) => e.text),
    timeToFailure: `P10 ${r.p10.toFixed(1)} days, P50 ${r.p50.toFixed(1)} days, P90 ${r.p90.toFixed(1)} days`,
    recommendedWindow: best.when,
    windowNote: best.note,
    chanceOfFailingFirst: pct(best.F),
    expectedCost: inr(best.E),
    breakdownBill: inr(run.cost.unplanned),
    part: input.scenario.partInStock ? '6205-2RS bearing, in stock at Laxmi Bearing House, ₹380' : `6205-2RS bearing, out of stock locally; the second dealer needs ${run.cost.partReadyIn} days`,
    drafts: 'A WhatsApp to the bearing dealer and a hold on the technician’s time',
    ownerDecision: DECISION[input.decision],
  };
}

/** The no-model note: the same facts, in a fixed sentence per language. */
export function templateNote(f: OwnerFacts, lang: Lang): string {
  const p = f.probability, when = f.recommendedWindow.split(',')[0];
  const tail = {
    en: { open: 'Nothing is sent until you approve.', approved: 'Approved: the drafts are on your phone, ready to send.', snoozed: 'Put off for now; the drafts stay held.' },
    hi: { open: 'आपकी मंज़ूरी के बिना कुछ नहीं भेजा जाएगा।', approved: 'मंज़ूर: मसौदे आपके फ़ोन पर भेजने के लिए तैयार हैं।', snoozed: 'अभी के लिए टाला गया; मसौदे रुके रहेंगे।' },
    mr: { open: 'तुमच्या मंजुरीशिवाय काहीही पाठवले जाणार नाही.', approved: 'मंजूर: मसुदे तुमच्या फोनवर पाठवण्यासाठी तयार आहेत.', snoozed: 'सध्या पुढे ढकलले; मसुदे थांबवून ठेवले आहेत.' },
  }[lang];
  const d = f.ownerDecision.startsWith('The owner approved') ? 'approved' : f.ownerDecision.startsWith('The owner chose') ? 'snoozed' : 'open';
  if (lang === 'hi') return `लूम 03 की मोटर के ड्राइव-एंड बेयरिंग की आउटर रेस में खराबी की संभावना ${p} है (${f.rule})। मरम्मत ${when} को करने पर अनुमानित ख़र्च ${f.expectedCost} है, जबकि ख़राब होने तक चलाने पर ${f.breakdownBill}। ${tail[d]}`;
  if (lang === 'mr') return `लूम 03 च्या मोटरच्या ड्राइव्ह-एंड बेअरिंगच्या आउटर रेसमध्ये बिघाड असण्याची शक्यता ${p} आहे (${f.rule}). दुरुस्ती ${when} रोजी केल्यास अपेक्षित खर्च ${f.expectedCost}; बंद पडेपर्यंत चालवल्यास ${f.breakdownBill}. ${tail[d]}`;
  return `Most likely cause on Loom 03's motor drive-end bearing: ${f.likelyCause}, ${p} (rule ${f.rule}). Repairing on ${when} costs about ${f.expectedCost}; running it to failure costs about ${f.breakdownBill}. ${tail[d]}`;
}

// ---------------------------------------------------------------- the number check
const DEVA = '०१२३४५६७८९';
/** Every number in a text, normalised (Devanagari digits read as 0–9, commas dropped, "03" → "3"). */
export function numbersIn(text: string): string[] {
  const t = text.replace(/[०-९]/g, (d) => String(DEVA.indexOf(d)));
  return (t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => String(Number(n.replace(/,/g, ''))));
}
/** A phrasing passes only if every number in it also appears in the facts. */
export function checkNumbers(text: string, facts: OwnerFacts) {
  const allowed = new Set(numbersIn(JSON.stringify(facts)));
  const found = numbersIn(text);
  const unknown = found.filter((n) => !allowed.has(n));
  return { ok: unknown.length === 0, count: found.length, unknown };
}

/** Accept only the four switches the console has; no free text reaches the model. */
export function parseNarrateInput(x: unknown): NarrateInput | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const sc = o.scenario as Record<string, unknown> | undefined;
  if (o.lang !== 'en' && o.lang !== 'hi' && o.lang !== 'mr') return null;
  if (!sc || typeof sc.powerCut !== 'boolean' || typeof sc.partInStock !== 'boolean') return null;
  if (typeof o.useNote !== 'boolean') return null;
  if (o.decision !== 'open' && o.decision !== 'approved' && o.decision !== 'snoozed') return null;
  return { lang: o.lang, scenario: { powerCut: sc.powerCut, partInStock: sc.partInStock }, useNote: o.useNote, decision: o.decision };
}
