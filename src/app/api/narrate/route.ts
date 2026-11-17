// The optional narrator. Claude phrases the owner's note from facts the server computes;
// it never sees free text from the browser and never does arithmetic. A phrasing that
// carries any number not in the facts is refused and the template is shown instead.
// Without ANTHROPIC_API_KEY the route reports itself disabled and the app uses the template.
import Anthropic from '@anthropic-ai/sdk';
import { getModel } from '@/lib/model';
import { checkNumbers, ownerFacts, parseNarrateInput } from '@/lib/agents/facts';

export const maxDuration = 30;

const MODEL = 'claude-opus-5-5';
const LANGUAGE = { en: 'English', hi: 'Hindi, in Devanagari script', mr: 'Marathi, in Devanagari script' } as const;
const SYSTEM = `You write one short note to the owner of a small powerloom shed in Maharashtra about one machine. NAADI's deterministic tools computed the facts; your only job is the wording.

Write two or three plain sentences the owner can read on a phone: what is most likely wrong and how sure NAADI is, which repair window is recommended and its expected cost against the breakdown bill, and where the owner's decision stands.

Rules:
- Use only the facts given. Add no advice, parts, prices, dates or causes that are not in them.
- Copy every number exactly as it appears in the facts, with the same digits and the ₹ sign. Never round, convert, add or compute a number. Use the digits 0-9 even when writing Hindi or Marathi.
- Mention the rule ID once.
- No greeting, no sign-off, no lists, no markdown.`;

const enabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

// There are only 72 possible inputs, so a phrasing is asked for at most once per server instance.
const cache = new Map<string, { text: string; model: string; numbers: number }>();

export async function GET() {
  return Response.json({ enabled: enabled(), model: MODEL });
}

export async function POST(request: Request) {
  const input = parseNarrateInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: 'Expected { lang, scenario: { powerCut, partInStock }, useNote, decision }' }, { status: 400 });
  if (!enabled()) return Response.json({ fallback: 'no-key' });
  const key = JSON.stringify(input);
  const hit = cache.get(key);
  if (hit) return Response.json({ ...hit, source: 'claude', cached: true });

  const facts = ownerFacts(getModel(), input);
  try {
    const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // a short note: low effort keeps the answer quick; thinking stays adaptive on this model
      output_config: { effort: 'low' },
      // if the model declines, the API retries on its default fallback model in the same call
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: `Language: ${LANGUAGE[input.lang]}\n\nFacts:\n${JSON.stringify(facts, null, 2)}` }],
    });
    if (msg.stop_reason === 'refusal') return Response.json({ fallback: 'refusal' });
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    if (!text || msg.stop_reason === 'max_tokens') return Response.json({ fallback: 'empty' });
    const check = checkNumbers(text, facts);
    if (!check.ok) return Response.json({ fallback: 'unchecked-number', unknown: check.unknown });
    const out = { text, model: msg.model, numbers: check.count };
    cache.set(key, out);
    return Response.json({ ...out, source: 'claude' });
  } catch (err) {
    const reason = err instanceof Anthropic.AuthenticationError ? 'auth'
      : err instanceof Anthropic.RateLimitError ? 'rate-limit'
      : err instanceof Anthropic.APIConnectionError ? 'network'
      : err instanceof Anthropic.APIError ? `api-${err.status ?? 'error'}`
      : 'error';
    console.error('narrator:', reason, err instanceof Error ? err.message : err);
    return Response.json({ fallback: reason });
  }
}
