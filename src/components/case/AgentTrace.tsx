import type { Step } from '@/lib/agents/pipeline';

export function AgentTrace({ steps }: { steps: Step[] }) {
  return (
    <ol className="trace-list">
      {steps.map((s) => (
        <li key={s.id} className={`${s.waiting ? 'is-wait' : ''}${s.agent === 'Owner' ? ' is-new step-in' : ''}`}>
          <span className="when">{s.at}</span>
          <span className="who">{s.agent}</span>
          <span>
            <code>{s.call}</code>
            <span className="res">{s.result}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
