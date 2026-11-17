// The agent run as a card chain for the jacquard reader. Each tool call is one card, and its
// eight holes are what that call actually read: Loom 03's punched channels, the tones that
// stand out of the envelope, the rules queried, the evidence weighed, the days at risk, the
// dealers and stock, the feasible and chosen windows, the drafts held. Nothing is decorative.
import type { NaadiModel } from '@/lib/model';
import { HYPOTHESES } from '@/lib/model/decide';
import { defectFactors, heightAt } from '@/lib/model/physics';
import type { ReaderCard } from '@/lib/reader/engine';
import type { RunInput, planRun } from './pipeline';

export interface StepCard extends ReaderCard {
  id: string;
  /** what each of the eight hole positions means on this card */
  positions: string[];
  /** where the call acts, for the tape */
  place: string;
}

const EVIDENCE = ['e1 envelope', 'e2 kurtosis', 'e3 note', 'e4 temp', 'BPFI gap', '1× flat', '', ''];

export function runCards(model: NaadiModel, input: RunInput, run: ReturnType<typeof planRun>): StepCard[] {
  const { steps, cost } = run;
  const best: string = cost.best.id;
  const feasible: string[] = cost.windows.filter((w) => w.feasible).map((w) => w.id);
  const L = model.loom;
  const now = L.cards[L.cards.length - 1];
  const fr = model.measuredRpm / 60;
  const F = defectFactors();
  const r = L.rul!;
  const out: StepCard[] = steps.map((s) => {
    const card = (positions: string[], holes: boolean[], place: string, paint: ReaderCard['paint'] = 'normal'): StepCard =>
      ({ id: s.id, positions, holes: positions.map((_, i) => !!holes[i]), place, paint });
    switch (s.id) {
      case 'score':
        return card(['Velocity', 'Kurtosis', 'Envelope', '1× shaft', '2× shaft', 'Sound', 'Current', 'Temp'], now.holes, 'Loom 03, card 56');
      case 'peaks': {
        const tones = [fr, 2 * fr, F.FTF * fr, F.BSF * fr, F.BPFO * fr, 2 * F.BPFO * fr, 3 * F.BPFO * fr, F.BPFI * fr];
        return card(['1×', '2×', 'FTF', 'BSF', 'BPFO', '2× BPFO', '3× BPFO', 'BPFI'], tones.map((hz) => heightAt(model.spec, hz) > 4), 'the drive-end accelerometer');
      }
      case 'rules': {
        const asked = ['BRG-', 'UNB-', 'ALN-'];
        return card(HYPOTHESES.map((h) => h.id.replace(/-0\d$/, '')), HYPOTHESES.map((h) => asked.some((a) => h.id.startsWith(a))), 'the rulebook');
      }
      case 'note':
        return card(EVIDENCE, [false, false, input.useNote], 'Sunita K., weaver', 'paper');
      case 'rank':
        return card(EVIDENCE, [true, true, input.useNote, true, true, true], 'the rulebook');
      case 'rul':
        return card(Array.from({ length: 8 }, (_, d) => `day ${d + 1}`), Array.from({ length: 8 }, (_, d) => r.cdf(d + 1) >= 0.1), 'Loom 03, cards 25–56');
      case 'stock':
        return card(['Laxmi', 'Shree', 'in stock', 'same day', '3 days', '6205-2RS', '₹380', 'rush rate'],
          input.scenario.partInStock ? [true, false, true, true, false, true, true, false] : [false, true, false, false, true, true, true, false],
          input.scenario.partInStock ? 'Laxmi Bearing House' : 'Shree Bearings, Kolhapur');
      case 'plan': {
        return card(['now', 'Thu', 'Sun', 'fail', 'pick now', 'pick Thu', 'pick Sun', 'pick fail'], [], 'the shed calendar');
      }
      case 'draft':
        return card(['WhatsApp', 'dealer', '2 × 6205', 'by Thu', 'by Sat', 'held', 'on phone', ''], [], 'the owner’s phone');
      case 'hold':
        return card(['Ramesh', 'Thu', 'Sun', '14:00', 'morning', 'held', 'booked', ''], [], 'Ramesh Patil, technician');
      case 'owner':
        return card(['approve', 'not now', 'undo', 'send', '', '', '', ''], [true], 'the owner', 'paper');
      default:
        return card(['', '', '', '', '', '', '', ''], [], '');
    }
  });
  // the planner, the drafts and the hold read the planner's own result
  const order = ['now', 'thu', 'sun', 'rtf'];
  return out.map((c) => {
    if (c.id === 'plan') return { ...c, holes: [...order.map((w) => feasible.includes(w)), ...order.map((w) => w === best)] };
    if (c.id === 'draft') return { ...c, holes: [true, true, true, best === 'thu', best === 'sun', input.decision !== 'approved', input.decision === 'approved', false] };
    if (c.id === 'hold') return { ...c, holes: [true, best === 'thu', best === 'sun', best === 'thu', best === 'sun', input.decision !== 'approved', input.decision === 'approved', false] };
    return c;
  });
}

/** The owner's card waits blank until the owner approves. */
export const OWNER_WAITING: StepCard = { id: 'owner-waiting', positions: ['approve', 'not now', 'undo', 'send', '', '', '', ''], holes: [false, false, false, false, false, false, false, false], place: 'the owner', paint: 'blank' };
